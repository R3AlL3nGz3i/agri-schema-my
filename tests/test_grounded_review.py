"""Tests for the Layer 2 retrieval-grounded reviewer (pipeline/grounded_review.py).

Fully offline + deterministic: no network, no Anthropic API, no ChromaDB.
`_call_anthropic` and `query_passages` are monkeypatched with in-process fakes.
Run: python tests/test_grounded_review.py
"""
import sys
import json
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import grounded_review as gr
from pipeline.compliance import load_reference

REF = load_reference()

# Two fake MARDI passages the reviewer will "retrieve".
FAKE_PASSAGES = [
    {"id": "doc__p1__c0", "text": "Tricyclazole 75WP is applied at 0.5 g per litre for blast.",
     "metadata": {"source_pdf": "fake.pdf", "page": 1}, "distance": 0.2},
    {"id": "doc__p2__c0", "text": "Field sanitation reduces inoculum carryover between seasons.",
     "metadata": {"source_pdf": "fake.pdf", "page": 2}, "distance": 0.4},
]

# The 3 safety-critical claim fields _entry()'s single treatment produces.
F_DOSE = "disease.treatments[0].dosage"
F_PHI = "disease.treatments[0].pre_harvest_interval_days"
F_REG = "disease.treatments[0].regulatory_status"


def _entry(compound="Paraquat"):
    """Paddy entry with one chemical treatment (dosage+PHI+registration => 3 claims).
    Default compound is banned so Layer 1 also raises a critical issue."""
    return {
        "crop": "paddy",
        "disease": {
            "name": "rice_blast",
            "local_name": "penyakit blas padi",
            "symptoms": {"visual": ["diamond-shaped lesions"], "growth": "stunted"},
            "treatments": [{
                "compound": compound,
                "dosage": "0.5g per litre water",
                "regulatory_status": "MY_approved",
                "pre_harvest_interval_days": 14,
            }],
            "rotation_partner": "Isoprothiolane",
            "application": "foliar spray, wear PPE",
            "instructions_bm": "Sembur pada daun.",
            "cultural_controls": ["resistant varieties", "field sanitation"],
        },
    }


def _entry_no_chemicals():
    """Entry that asserts no dosage/PHI/registration -> no safety claims required."""
    return {
        "crop": "paddy",
        "disease": {
            "name": "bacterial_leaf_blight",
            "symptoms": {"visual": ["water-soaked lesions"], "growth": "wilting"},
            "treatments": [],
            "cultural_controls": ["resistant varieties", "no curative chemical treatment"],
        },
    }


def _grounded_claims(fields, label="P1", quote="0.5 g per litre"):
    return [{"field": f, "claim": "c", "supported": True,
             "grounding": {"passage_id": label, "quote": quote}} for f in fields]


class _Recorder:
    """Fake _call_anthropic that records the prompt and returns canned JSON."""
    def __init__(self, response: str):
        self.response = response
        self.prompt = None

    def __call__(self, prompt: str) -> str:
        self.prompt = prompt
        return self.response


def _patch(call_fake, passages=FAKE_PASSAGES):
    gr._call_anthropic = call_fake
    gr.query_passages = lambda text, k=6: list(passages)


# ---------------------------------------------------------------------------

def test_prompt_embeds_passages_layer1_and_claims():
    rec = _Recorder(json.dumps({"verdict": "FLAG", "claims": [], "issues": [], "notes": "n"}))
    _patch(rec)
    gr.review_entry_grounded(_entry(compound="Paraquat"), k=6, reference=REF)
    p = rec.prompt
    assert "[P1]" in p and "[P2]" in p
    assert "Tricyclazole 75WP is applied at 0.5 g per litre" in p
    assert "Layer 1 verdict:" in p and "[critical]" in p          # banned compound
    assert "SAFETY-CRITICAL CLAIMS" in p
    assert F_DOSE in p and F_PHI in p and F_REG in p              # claims enumerated


def test_fully_grounded_claims_allow_pass():
    rec = _Recorder(json.dumps({
        "verdict": "PASS",
        "claims": _grounded_claims([F_DOSE, F_PHI, F_REG]),
        "issues": [], "notes": "",
    }))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["verdict"] == "PASS"
    assert out["grounded_count"] == 3
    assert out["ungrounded_count"] == 0


def test_unsupported_safety_claim_forces_flag():
    rec = _Recorder(json.dumps({
        "verdict": "PASS",
        "claims": [{"field": F_DOSE, "claim": "c", "supported": False, "grounding": None},
                   {"field": F_PHI, "claim": "c", "supported": False, "grounding": None},
                   {"field": F_REG, "claim": "c", "supported": False, "grounding": None}],
        "issues": [], "notes": "",
    }))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["verdict"] == "FLAG"          # unsupported dosage/PHI cannot PASS
    assert out["ungrounded_count"] == 3


def test_missing_claims_array_forces_flag():
    # Absence of evidence: model raises no issue and omits claims -> must not PASS.
    rec = _Recorder(json.dumps({"verdict": "PASS", "issues": [], "notes": ""}))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["verdict"] == "FLAG"
    assert out["ungrounded_count"] == 3


def test_empty_retrieval_cannot_pass():
    rec = _Recorder(json.dumps({
        "verdict": "PASS",
        "claims": _grounded_claims([F_DOSE, F_PHI, F_REG]),  # cite P1 but nothing retrieved
        "issues": [], "notes": "",
    }))
    _patch(rec, passages=[])
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["verdict"] == "FLAG"
    assert out["ungrounded_count"] == 3


def test_fabricated_passage_id_counts_as_ungrounded():
    rec = _Recorder(json.dumps({
        "verdict": "PASS",
        "claims": _grounded_claims([F_DOSE, F_PHI, F_REG], label="P9"),  # P9 not retrieved
        "issues": [], "notes": "",
    }))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["verdict"] == "FLAG"
    assert out["ungrounded_count"] == 3


def test_ungrounded_critical_issue_forces_flag_even_if_claims_grounded():
    rec = _Recorder(json.dumps({
        "verdict": "PASS",
        "claims": _grounded_claims([F_DOSE, F_PHI, F_REG]),
        "issues": [{"severity": "critical", "field": F_DOSE, "issue": "i",
                    "suggestion": "s", "grounding": None}],
        "notes": "",
    }))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["verdict"] == "FLAG"
    assert out["grounded_count"] == 3        # claims still counted grounded


def test_no_safety_claims_entry_can_pass():
    rec = _Recorder(json.dumps({"verdict": "PASS", "claims": [], "issues": [], "notes": ""}))
    _patch(rec)
    out = gr.review_entry_grounded(_entry_no_chemicals(), k=6, reference=REF)
    assert out["verdict"] == "PASS"          # honesty-credit: no chemical claims to ground
    assert out["required_claims"] == 0


def test_parse_failure_returns_none():
    rec = _Recorder("this is not JSON at all {oops")
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out is None


def test_invalid_verdict_returns_none():
    rec = _Recorder(json.dumps({"verdict": "MAYBE", "claims": [], "issues": []}))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out is None


def test_parse_failure_writes_no_cache():
    rec = _Recorder("garbage not json")
    _patch(rec)
    with tempfile.TemporaryDirectory() as tmp:
        reviews_dir = Path(tmp) / "reviews_grounded"
        gr.review_paddy(k=6, reviews_dir=reviews_dir)
        cached = list(reviews_dir.rglob("*.json")) if reviews_dir.exists() else []
        assert cached == []          # None reviews are never cached


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception:
            failed += 1
            print(f"FAIL  {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
