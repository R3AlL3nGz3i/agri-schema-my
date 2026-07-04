"""
Schema validator.
Checks every YAML entry for required fields and valid values.
Runs as CI gate (GitHub Actions) — exits 1 if any entry fails.
"""
import yaml
from pathlib import Path
import sys
import logging

logger = logging.getLogger(__name__)

VALID_PATHOGEN_TYPES = {"fungi", "bacteria", "virus", "pest", "nematode", "abiotic", "oomycete", "unknown"}
VALID_REGULATORY_STATUS = {"MY_approved", "MY_restricted", "MY_banned", "unknown"}


def validate_entry(entry: dict) -> list[str]:
    """Return list of error strings. Empty list = PASS."""
    errors = []

    if not isinstance(entry.get("crop"), str) or not entry["crop"].strip():
        errors.append("crop: required string")

    disease = entry.get("disease")
    if not isinstance(disease, dict):
        errors.append("disease: required dict")
        return errors  # can't check sub-fields

    if not isinstance(disease.get("name"), str) or not disease["name"].strip():
        errors.append("disease.name: required string")

    pathogen = disease.get("pathogen")
    if not isinstance(pathogen, dict):
        errors.append("disease.pathogen: required dict")
    elif pathogen.get("type") not in VALID_PATHOGEN_TYPES:
        errors.append(f"disease.pathogen.type: must be one of {VALID_PATHOGEN_TYPES}")

    symptoms = disease.get("symptoms")
    if not isinstance(symptoms, dict):
        errors.append("disease.symptoms: required dict")
    elif not isinstance(symptoms.get("visual"), list) or len(symptoms["visual"]) == 0:
        errors.append("disease.symptoms.visual: required non-empty list")

    treatments = disease.get("treatments")
    if not isinstance(treatments, list) or len(treatments) == 0:
        errors.append("disease.treatments: required non-empty list")
    else:
        for i, t in enumerate(treatments):
            if not isinstance(t, dict):
                errors.append(f"disease.treatments[{i}]: must be dict")
                continue
            if not t.get("compound"):
                errors.append(f"disease.treatments[{i}].compound: required")
            if not t.get("dosage"):
                errors.append(f"disease.treatments[{i}].dosage: required")
            status = t.get("regulatory_status", "")
            if status not in VALID_REGULATORY_STATUS:
                errors.append(f"disease.treatments[{i}].regulatory_status: must be one of {VALID_REGULATORY_STATUS}")

    citations = disease.get("source_citations")
    if not isinstance(citations, list) or len(citations) == 0:
        errors.append("disease.source_citations: required non-empty list")

    score = disease.get("confidence_score")
    if score is None or not isinstance(score, (int, float)) or not (0.0 <= float(score) <= 1.0):
        errors.append("disease.confidence_score: required float 0.0–1.0")

    return errors


def validate_all(data_dir: Path = Path("data")) -> dict:
    """Validate all YAML entries in data/crops/**/diseases/. Returns summary dict."""
    results = {"passed": [], "failed": {}, "total": 0}

    for yaml_file in sorted(data_dir.glob("crops/**/diseases/*.yaml")):
        results["total"] += 1
        try:
            entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            errors = validate_entry(entry)
            if errors:
                results["failed"][str(yaml_file)] = errors
            else:
                results["passed"].append(str(yaml_file))
        except yaml.YAMLError as e:
            results["failed"][str(yaml_file)] = [f"Invalid YAML: {e}"]
        except Exception as e:
            results["failed"][str(yaml_file)] = [f"Unexpected error: {e}"]

    return results


if __name__ == "__main__":
    results = validate_all()

    print(f"\n{'='*60}")
    print("SCHEMA VALIDATION")
    print(f"{'='*60}")
    print(f"Total:   {results['total']}")
    print(f"Passed:  {len(results['passed'])}")
    print(f"Failed:  {len(results['failed'])}")

    if results["failed"]:
        print("\nFAILURES:")
        for filepath, errors in results["failed"].items():
            print(f"\n  {filepath}")
            for err in errors:
                print(f"    x {err}")
        sys.exit(1)

    print("\nAll entries valid.")
    sys.exit(0)
