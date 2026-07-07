"""
Layer 2 — retrieval-grounded reviewer (paddy prototype).

Unlike the Layer 1 professor agent (which reviews from the model's own
knowledge), this reviewer must quote retrieved MARDI source passages. Every
factual claim it uses to justify a verdict has to point at a passage id; any
claim the provided passages do not support is marked `grounding: null` and
cannot justify a PASS. This makes verdicts checkable rather than vibes.

Prototype scope: paddy only. Verdicts are written to a cache under
data/reviews_grounded/ and do NOT mutate the source YAML (reversible).

Reuses the professor persona + Anthropic plumbing from professor_agent, the
Layer 1 findings from compliance, and the passage retrieval from embedder.
"""
import json
from pathlib import Path
from datetime import date
from typing import Optional
import logging

import yaml

from pipeline.professor_agent import (
    _load_api_key,        # noqa: F401 (kept for parity / callers)
    _call_anthropic,
    _extract_json,
    _slim_entry,
    PROFESSOR_SYSTEM,     # noqa: F401 (used as system prompt inside _call_anthropic)
)
from pipeline.embedder import query_passages
from pipeline.compliance import load_reference, check_entry

logger = logging.getLogger(__name__)

_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent
_DATA_DIR = _PROJECT_ROOT / "data"
_PADDY_DIR = _DATA_DIR / "crops" / "paddy" / "diseases"
_REVIEWS_DIR = _DATA_DIR / "reviews_grounded"


GROUNDED_PROMPT = """You are grounding-reviewing a Malaysian crop disease entry.

You may ONLY treat a factual claim as supported if one of the RETRIEVED PASSAGES
below states it. Passages are labelled [P1]..[P{k}] with their source. Your own
agronomic knowledge does NOT count as support — only the passages do.

RETRIEVED PASSAGES:
{passages}

LAYER 1 (deterministic compliance) already found these issues — take them into account:
{layer1}

ENTRY UNDER REVIEW:
{entry_yaml}

SAFETY-CRITICAL CLAIMS YOU MUST VERIFY (one verdict per claim):
{claims}

Rules:
- For EACH safety-critical claim above, decide whether a retrieved passage
  actually supports it. Set "supported": true ONLY if a passage states the same
  fact, and set "grounding": {{"passage_id": "P#", "quote": "<=25 words copied
  verbatim from that passage"}}. If NO passage supports it, set
  "supported": false and "grounding": null. Absence of a supporting passage is
  NOT support — mark it unsupported, never assume it from your own knowledge.
- NEVER invent a passage id or a quote.
- For each problem you raise, attach the same grounding object (or null).
- A verdict of PASS is allowed ONLY if EVERY safety-critical claim is supported
  by a passage. If any dosage/PHI/registration claim is unsupported, the correct
  verdict is FLAG (the fact is unverifiable from the available source), never PASS.

Output exactly this JSON (no text outside it):
{{
  "verdict": "PASS" | "FLAG" | "REJECT",
  "claims": [
    {{
      "field": "disease.treatments[0].dosage",
      "claim": "the claim text as given above",
      "supported": true,
      "grounding": {{"passage_id": "P1", "quote": "..."}}
    }}
  ],
  "issues": [
    {{
      "severity": "critical" | "warning" | "info",
      "field": "disease.treatments[0].pre_harvest_interval_days",
      "issue": "what is specifically wrong or unverifiable",
      "suggestion": "how to fix",
      "grounding": {{"passage_id": "P1", "quote": "..."}}
    }}
  ],
  "notes": "reasoning, including which key facts the passages could not support",
  "reviewed_by": "Layer 2 grounded reviewer (AI, MARDI-passage-grounded)",
  "review_date": "{today}"
}}"""


def _build_query(entry: dict) -> str:
    """Assemble a retrieval query from crop + disease + symptoms + compounds."""
    disease = entry.get("disease", {})
    crop = entry.get("crop", "") or ""
    name = (disease.get("name", "") or "").replace("_", " ")
    local = disease.get("local_name", "") or ""
    visual = disease.get("symptoms", {}).get("visual", []) or []
    compounds = [t.get("compound", "") for t in disease.get("treatments", []) if t.get("compound")]
    parts = [crop, name, local] + list(visual[:3]) + compounds
    return " ".join(p for p in parts if p).strip()


def _format_passages(passages: list[dict]) -> tuple[str, set]:
    """Render retrieved passages as [P1].. blocks; return (text, valid_label_set)."""
    if not passages:
        return "(no passages retrieved)", set()
    lines = []
    labels = set()
    for i, p in enumerate(passages, start=1):
        label = f"P{i}"
        labels.add(label)
        meta = p.get("metadata", {})
        src = meta.get("source_pdf", "?")
        page = meta.get("page", "?")
        lines.append(f"[{label}] (source: {src} p.{page})\n{p.get('text', '')}")
    return "\n\n".join(lines), labels


def _format_layer1(layer1: dict) -> str:
    """Render Layer 1 compliance findings compactly for the prompt."""
    issues = layer1.get("issues", [])
    header = f"Layer 1 verdict: {layer1.get('verdict', 'UNKNOWN')}"
    if not issues:
        return header + " (no deterministic issues)"
    lines = [header]
    for it in issues:
        lines.append(
            f"- [{it.get('severity')}] {it.get('field')}: {it.get('issue')} "
            f"(fix: {it.get('suggestion')})"
        )
    return "\n".join(lines)


def _is_grounded(issue: dict, valid_labels: set) -> bool:
    """A claim is grounded only if it cites a real retrieved passage with a quote."""
    g = issue.get("grounding")
    if not isinstance(g, dict):
        return False
    pid = g.get("passage_id")
    quote = (g.get("quote") or "").strip()
    return bool(pid) and pid in valid_labels and bool(quote)


def _safety_claims(entry: dict) -> list[dict]:
    """Deterministically enumerate the entry's poison-relevant claims that MUST be
    grounded before a PASS: per-treatment dosage, pre-harvest interval, and
    registration status. Derived from the YAML, not from the model, so the model
    cannot avoid scrutiny by simply not raising an issue."""
    claims = []
    for i, t in enumerate(entry.get("disease", {}).get("treatments", []) or []):
        base = f"disease.treatments[{i}]"
        comp = t.get("compound", "") or f"treatment {i}"
        if t.get("dosage"):
            claims.append({"field": f"{base}.dosage", "claim": f"{comp} dosage: {t['dosage']}"})
        phi = t.get("pre_harvest_interval_days")
        if phi is not None:
            claims.append({"field": f"{base}.pre_harvest_interval_days",
                           "claim": f"{comp} pre-harvest interval: {phi} days"})
        if t.get("regulatory_status"):
            claims.append({"field": f"{base}.regulatory_status",
                           "claim": f"{comp} regulatory status: {t['regulatory_status']}"})
    return claims


def _format_claims(claims: list[dict]) -> str:
    if not claims:
        return "(entry asserts no chemical dosage/PHI/registration claims)"
    return "\n".join(f"- [{c['field']}] {c['claim']}" for c in claims)


def _claim_supported(model_claim: dict, valid_labels: set) -> bool:
    """A safety claim counts as grounded only if the model marked it supported AND
    cited a real retrieved passage with a quote."""
    return model_claim.get("supported") is True and _is_grounded(model_claim, valid_labels)


def review_entry_grounded(entry: dict, k: int = 6, reference: dict = None) -> Optional[dict]:
    """
    Grounded review of one entry. Returns review dict, or None on parse failure
    (caller must NOT cache None). Enforces: PASS requires no ungrounded critical
    claim; a passage_id that was not retrieved counts as ungrounded.
    """
    if reference is None:
        reference = load_reference()

    query = _build_query(entry)
    passages = query_passages(query, k=k)
    passages_text, valid_labels = _format_passages(passages)

    layer1 = check_entry(entry, reference)
    layer1_text = _format_layer1(layer1)

    required_claims = _safety_claims(entry)

    entry_yaml = yaml.dump(_slim_entry(entry), allow_unicode=True, default_flow_style=False)
    prompt = GROUNDED_PROMPT.format(
        k=k,
        passages=passages_text,
        layer1=layer1_text,
        entry_yaml=entry_yaml,
        claims=_format_claims(required_claims),
        today=date.today().isoformat(),
    )

    try:
        raw = _call_anthropic(prompt)
        result = _extract_json(raw)
    except Exception as e:  # parse or API failure after internal retries
        logger.error(f"Grounded review failed to parse/complete: {e}. Not caching.")
        return None

    if result.get("verdict") not in ("PASS", "FLAG", "REJECT"):
        logger.error(f"Grounded review returned invalid verdict: {result.get('verdict')}. Not caching.")
        return None

    # --- Safety-critical claim coverage (the load-bearing gate) ---------------
    # Match the model's per-claim verdicts back to the claims WE required. A claim
    # the model omitted, marked unsupported, or grounded in a non-retrieved passage
    # is ungrounded. Absence of evidence never counts as support.
    model_claims = {c.get("field"): c for c in (result.get("claims", []) or []) if isinstance(c, dict)}
    grounded_fields, ungrounded_fields = [], []
    for rc in required_claims:
        mc = model_claims.get(rc["field"])
        if mc and _claim_supported(mc, valid_labels):
            grounded_fields.append(rc["field"])
        else:
            ungrounded_fields.append(rc["field"])

    issues = result.get("issues", []) or []
    ungrounded_critical_issues = [
        it for it in issues
        if it.get("severity") == "critical" and not _is_grounded(it, valid_labels)
    ]

    verdict = result["verdict"]
    notes = result.get("notes", "") or ""
    if verdict == "PASS":
        reasons = []
        if not passages:
            reasons.append("no source passages retrieved")
        if ungrounded_fields:
            reasons.append(f"{len(ungrounded_fields)} safety-critical claim(s) unsupported: "
                           + ", ".join(ungrounded_fields))
        if ungrounded_critical_issues:
            reasons.append(f"{len(ungrounded_critical_issues)} ungrounded critical issue(s)")
        if reasons:
            verdict = "FLAG"
            notes = (notes + " [auto: downgraded PASS->FLAG — " + "; ".join(reasons) + "]").strip()

    return {
        "verdict": verdict,
        "issues": issues,
        "required_claims": len(required_claims),
        "grounded_count": len(grounded_fields),
        "ungrounded_count": len(ungrounded_fields),
        "ungrounded_fields": ungrounded_fields,
        "retrieved_passages": [
            {"label": f"P{i}", "source_pdf": p.get("metadata", {}).get("source_pdf"),
             "page": p.get("metadata", {}).get("page"), "distance": p.get("distance")}
            for i, p in enumerate(passages, start=1)
        ],
        "notes": notes,
        "reviewed_by": result.get("reviewed_by", "Layer 2 grounded reviewer (AI, MARDI-passage-grounded)"),
        "review_date": result.get("review_date", date.today().isoformat()),
    }


def review_paddy(k: int = 6, data_dir: Path = None, reviews_dir: Path = None) -> dict:
    """
    Batch grounded review over paddy entries. Caches to data/reviews_grounded/;
    does NOT mutate source YAML (prototype is reversible). Prints a
    grounding-coverage summary and returns per-entry stats.
    """
    if data_dir is None:
        data_dir = _DATA_DIR
    if reviews_dir is None:
        reviews_dir = _REVIEWS_DIR
    paddy_dir = data_dir / "crops" / "paddy" / "diseases"

    reference = load_reference()
    reviews_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for yaml_file in sorted(paddy_dir.glob("*.yaml")):
        cache_path = reviews_dir / yaml_file.relative_to(data_dir).with_suffix(".json")
        cache_path.parent.mkdir(parents=True, exist_ok=True)

        if cache_path.exists():
            review = json.loads(cache_path.read_text(encoding="utf-8"))
            logger.info(f"Cached grounded review {yaml_file.name}: {review.get('verdict')}")
        else:
            entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            logger.info(f"Grounded reviewing: {yaml_file.name}")
            review = review_entry_grounded(entry, k=k, reference=reference)
            if review is None:
                logger.error(f"Parse failure for {yaml_file.name} — not cached, will retry next run")
                results.append({"file": yaml_file.name, "verdict": "ERROR",
                                "grounded": 0, "ungrounded": 0})
                continue
            cache_path.write_text(json.dumps(review, indent=2, ensure_ascii=False), encoding="utf-8")

        results.append({
            "file": yaml_file.name,
            "verdict": review.get("verdict"),
            "grounded": review.get("grounded_count", 0),
            "ungrounded": review.get("ungrounded_count", 0),
        })

    _print_coverage(results)
    return {"results": results}


def _print_coverage(results: list[dict]):
    print(f"\n{'='*64}")
    print("LAYER 2 GROUNDED REVIEW — paddy prototype coverage")
    print(f"{'='*64}")
    print(f"{'entry':40s} {'verdict':8s} {'grounded':>8s} {'ungrnd':>7s}")
    tot_g = tot_u = 0
    for r in results:
        print(f"{r['file']:40s} {str(r['verdict']):8s} {r['grounded']:>8d} {r['ungrounded']:>7d}")
        tot_g += r["grounded"]
        tot_u += r["ungrounded"]
    total_claims = tot_g + tot_u
    cov = (100 * tot_g / total_claims) if total_claims else 0.0
    print(f"{'-'*64}")
    print(f"Total claims grounded: {tot_g}/{total_claims} ({cov:.1f}%)  ungrounded: {tot_u}")
    print("Interpretation: high ungrounded share => MARDI bulletins lack per-product")
    print("dosage/PHI facts; grounding against this source is not sufficient.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    review_paddy()
