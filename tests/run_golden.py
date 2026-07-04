"""
Golden-query evaluation runner for AgriSchema-MY.
Queries the Chroma collection the same way api/main.py does
and checks whether expected_crop / expected_disease appear in top-3.

Run from repo root:
    .venv/bin/python tests/run_golden.py
"""
import json
import sys
from pathlib import Path

# Ensure repo root is on sys.path so pipeline imports work
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Must run with cwd = repo root so CHROMA_PATH = "data/chroma" resolves correctly
import os
os.chdir(REPO_ROOT)

from pipeline.embedder import query as vector_query

GOLDEN_PATH = Path(__file__).parent / "golden_queries.json"


def run_eval():
    queries = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))

    results_summary = []
    hit = 0
    total = 0

    for q in queries:
        qid = q["id"]
        params = q["query"]
        expected_crop = q.get("expected_crop")
        expected_disease = q.get("expected_disease")
        note = q.get("note", "")

        # Q09: sayuran has no indexed entries — skip
        if params.get("crop") == "sayuran":
            print(f"[{qid}] SKIP  — crop 'sayuran' has no indexed entries (note: {note or 'no data'})")
            results_summary.append({"id": qid, "result": "SKIP", "reason": "no indexed entries for sayuran"})
            continue

        crop_param = params.get("crop")
        symptom_param = params.get("symptom")

        try:
            results = vector_query(crop=crop_param, symptom=symptom_param, n_results=3)
        except Exception as e:
            print(f"[{qid}] ERROR — query failed: {e}")
            results_summary.append({"id": qid, "result": "ERROR", "reason": str(e)})
            continue

        # Extract top-3 crops and disease names (normalised)
        top_crops = [r["metadata"].get("crop", "").lower() for r in results]
        top_disease_names = [r["metadata"].get("disease_name", "").lower() for r in results]

        # Build a slug from disease_name for matching against expected_disease slug
        def slugify(s):
            return s.lower().replace(" ", "_").replace("-", "_") if s else ""

        top_disease_slugs = [slugify(n) for n in top_disease_names]

        # Q06 only checks crop (no expected_disease)
        if expected_disease is None:
            passed = expected_crop and expected_crop.lower() in top_crops
        else:
            expected_disease_slug = slugify(expected_disease)
            disease_hit = expected_disease_slug in top_disease_slugs
            crop_hit = (not expected_crop) or (expected_crop.lower() in top_crops)
            passed = disease_hit and crop_hit

        total += 1
        status = "PASS" if passed else "FAIL"
        if passed:
            hit += 1

        # Show top-3 for visibility
        top3_str = "; ".join(
            f"{r['metadata'].get('crop','?')}/{slugify(r['metadata'].get('disease_name','?'))}"
            for r in results
        )
        print(f"[{qid}] {status:<4}  expected={expected_crop}/{expected_disease}  top3=[{top3_str}]  {note}")
        results_summary.append({
            "id": qid,
            "result": status,
            "expected_crop": expected_crop,
            "expected_disease": expected_disease,
            "top3": top3_str,
        })

    print()
    skipped = len(queries) - total
    print(f"Hit-rate: {hit}/{total} = {hit/total*100:.0f}%  (skipped {skipped})")
    return results_summary


if __name__ == "__main__":
    run_eval()
