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


def _entry(compound="Paraquat"):
    """Paddy entry; default compound is banned so Layer 1 raises a critical issue."""
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


class _Recorder:
    """Callable fake for _call_anthropic that records the prompt and returns canned JSON."""
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

def test_prompt_embeds_passages_and_layer1_findings():
    rec = _Recorder(json.dumps({
        "verdict": "FLAG", "issues": [], "notes": "n",
        "reviewed_by": "x", "review_date": "2026-07-07",
    }))
    _patch(rec)
    gr.review_entry_grounded(_entry(compound="Paraquat"), k=6, reference=REF)
    p = rec.prompt
    # (a) retrieved passages present, labelled
    assert "[P1]" in p and "[P2]" in p
    assert "Tricyclazole 75WP is applied at 0.5 g per litre" in p
    # Layer 1 deterministic findings embedded (banned compound -> critical issue)
    assert "Layer 1 verdict:" in p
    assert "[critical]" in p


def test_ungrounded_critical_claim_forces_non_pass():
    rec = _Recorder(json.dumps({
        "verdict": "PASS",
        "issues": [{
            "severity": "critical", "field": "disease.treatments[0].dosage",
            "issue": "dosage unverifiable", "suggestion": "verify",
            "grounding": None,
        }],
        "notes": "", "reviewed_by": "x", "review_date": "2026-07-07",
    }))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out is not None
    assert out["verdict"] != "PASS"          # downgraded
    assert out["verdict"] == "FLAG"
    assert out["ungrounded_count"] == 1
    assert out["grounded_count"] == 0


def test_fabricated_passage_id_counts_as_ungrounded():
    # Cites P9 which was never retrieved -> must be treated as ungrounded.
    rec = _Recorder(json.dumps({
        "verdict": "PASS",
        "issues": [{
            "severity": "critical", "field": "f", "issue": "i", "suggestion": "s",
            "grounding": {"passage_id": "P9", "quote": "invented"},
        }],
        "notes": "", "reviewed_by": "x", "review_date": "2026-07-07",
    }))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["verdict"] == "FLAG"
    assert out["ungrounded_count"] == 1


def test_grounded_claim_is_counted():
    rec = _Recorder(json.dumps({
        "verdict": "FLAG",
        "issues": [{
            "severity": "warning", "field": "disease.treatments[0].dosage",
            "issue": "check dose", "suggestion": "confirm",
            "grounding": {"passage_id": "P1", "quote": "0.5 g per litre"},
        }],
        "notes": "", "reviewed_by": "x", "review_date": "2026-07-07",
    }))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out["grounded_count"] == 1
    assert out["ungrounded_count"] == 0


def test_parse_failure_returns_none():
    rec = _Recorder("this is not JSON at all {oops")
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


def test_invalid_verdict_returns_none():
    rec = _Recorder(json.dumps({"verdict": "MAYBE", "issues": []}))
    _patch(rec)
    out = gr.review_entry_grounded(_entry(), k=6, reference=REF)
    assert out is None


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
