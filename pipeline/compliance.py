"""
Layer 1 — deterministic compliance gate (Professor Agent v2).
See REVIEW_GATE_DESIGN.md §4. Runs BEFORE any LLM review.

Deterministic, auditable, offline checks against Malaysian pesticide reference
data. No network, no LLM. Hard safety/legality lives here so the LLM only ever
grades entries that already clear the law.

Verdict precedence: REJECT (hard block) > FLAG (must-fix before publish) > PASS.
  - critical issue -> REJECT
  - warning  issue -> FLAG
  - otherwise      -> PASS

NOTE: the datasets under data/reference/ are STUBS pending authoritative DOA /
Lembaga Racun Makhluk Perosak registration + Codex/EU MRL data.
  - The banned denylist is enforced now (a hit is always valid).
  - The registration allowlist is DISABLED until its `status` is `authoritative`
    (an incomplete allowlist would false-reject valid compounds).
"""
import yaml
from pathlib import Path
import sys
import logging

logger = logging.getLogger(__name__)

_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent
_REF_DIR = _PROJECT_ROOT / "data" / "reference"

# v2 schema fields required for a farmer-facing entry (REVIEW_GATE_DESIGN.md §5).
REQUIRED_PRACTICALITY_FIELDS = ("rotation_partner", "application", "instructions_bm")


def _norm(name) -> str:
    return (name or "").strip().lower()


def _issue(severity: str, field: str, issue: str, suggestion: str) -> dict:
    return {"severity": severity, "field": field, "issue": issue, "suggestion": suggestion}


def _verdict(issues: list) -> str:
    if any(i["severity"] == "critical" for i in issues):
        return "REJECT"
    if any(i["severity"] == "warning" for i in issues):
        return "FLAG"
    return "PASS"


def load_reference(ref_dir: Path = None) -> dict:
    """Load reference datasets into normalised lookup structures."""
    if ref_dir is None:
        ref_dir = _REF_DIR

    def _load(name: str) -> dict:
        path = ref_dir / name
        if not path.exists():
            logger.warning(f"Reference file missing: {path}")
            return {}
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}

    banned_raw = _load("banned_compounds.yaml")
    return {
        "banned": {_norm(x.get("name")) for x in banned_raw.get("banned", [])},
        "restricted": {_norm(x.get("name")) for x in banned_raw.get("restricted", [])},
        "registry": _load("registered_compounds.yaml"),
        "mrl": _load("crop_mrl.yaml"),
    }


def check_entry(entry: dict, reference: dict) -> dict:
    """Run Layer 1 checks on one entry. Returns {verdict, issues:[...]}."""
    issues = []
    crop = _norm(entry.get("crop"))
    disease = entry.get("disease") or {}

    mrl = reference.get("mrl", {})
    registry = reference.get("registry", {})
    food_crops = {_norm(c) for c in mrl.get("food_crops", [])}
    non_food = {_norm(c) for c in mrl.get("non_food_crops", [])}
    default_phi = mrl.get("default_min_phi_days", 7)
    crop_cfg = (mrl.get("crops") or {}).get(crop, {}) or {}
    min_phi = crop_cfg.get("min_phi_days", default_phi)
    # Unknown crop -> treat as food (the safer default for a residue check).
    is_food = crop in food_crops or crop not in non_food

    registry_authoritative = registry.get("status") == "authoritative"
    approved_for_crop = {_norm(c) for c in (registry.get("approved", {}) or {}).get(crop, [])}

    treatments = disease.get("treatments") or []
    for i, t in enumerate(treatments):
        field = f"disease.treatments[{i}]"
        compound = _norm(t.get("compound"))
        raw_name = t.get("compound")
        status = t.get("regulatory_status", "")

        # 1. Banned denylist + schema banned status -> REJECT
        if compound in reference["banned"] or status == "MY_banned":
            issues.append(_issue(
                "critical", f"{field}.compound",
                f"'{raw_name}' is banned/withdrawn in Malaysia",
                "Remove this treatment; substitute a registered alternative."))
        # Restricted -> FLAG
        elif compound in reference["restricted"] or status == "MY_restricted":
            issues.append(_issue(
                "warning", f"{field}.compound",
                f"'{raw_name}' is restricted — export/residue risk",
                "Confirm the approved use pattern before publishing."))

        # 2. Registration allowlist (only enforced when registry is authoritative)
        if registry_authoritative and compound and compound not in approved_for_crop:
            issues.append(_issue(
                "critical", f"{field}.compound",
                f"'{raw_name}' is not registered for {entry.get('crop')} in the DOA registry",
                "Off-label use is illegal; use a registered compound."))

        # 3. PHI adequacy on food crops
        if is_food:
            phi = t.get("pre_harvest_interval_days")
            if phi is None:
                issues.append(_issue(
                    "warning", f"{field}.pre_harvest_interval_days",
                    "missing pre-harvest interval on a food crop",
                    f"Add a PHI >= {min_phi} days to clear residue limits."))
            elif isinstance(phi, (int, float)) and phi < min_phi:
                issues.append(_issue(
                    "warning", f"{field}.pre_harvest_interval_days",
                    f"PHI {phi}d is below the {min_phi}d minimum for {entry.get('crop')}",
                    "Raise the PHI or substitute a shorter-residue compound."))

    # 4. v2 field-practicality presence (REVIEW_GATE_DESIGN.md §5)
    for f_name in REQUIRED_PRACTICALITY_FIELDS:
        if not disease.get(f_name):
            issues.append(_issue(
                "warning", f"disease.{f_name}",
                f"missing '{f_name}' — required for farmer-facing safety/clarity",
                "Populate before publish (Layer 1, v2 schema)."))
    if not (disease.get("cultural_controls") or disease.get("ipm_controls")):
        issues.append(_issue(
            "warning", "disease.cultural_controls",
            "no IPM / cultural controls listed before chemical treatment",
            "Add non-chemical controls (IPM-first)."))

    return {"verdict": _verdict(issues), "issues": issues}


def check_all(data_dir: Path = None, ref_dir: Path = None) -> dict:
    """Run Layer 1 over all entries. Returns a verdict summary + per-file issues."""
    if data_dir is None:
        data_dir = _PROJECT_ROOT / "data"
    reference = load_reference(ref_dir)

    summary = {"PASS": [], "FLAG": [], "REJECT": [], "errors": [], "details": {}}
    for yaml_file in sorted(data_dir.glob("crops/**/diseases/*.yaml")):
        try:
            entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            result = check_entry(entry, reference)
            summary[result["verdict"]].append(str(yaml_file))
            summary["details"][str(yaml_file)] = result["issues"]
        except Exception as e:
            summary["errors"].append(str(yaml_file))
            logger.error(f"Compliance check failed for {yaml_file}: {e}")
    return summary


def print_report(summary: dict):
    total = sum(len(summary.get(k, [])) for k in ("PASS", "FLAG", "REJECT", "errors"))
    print(f"\n{'='*60}")
    print("LAYER 1 — COMPLIANCE GATE")
    print(f"{'='*60}")
    print(f"PASS:    {len(summary.get('PASS', []))}")
    print(f"FLAG:    {len(summary.get('FLAG', []))}")
    print(f"REJECT:  {len(summary.get('REJECT', []))}")
    print(f"ERRORS:  {len(summary.get('errors', []))}")

    for verdict, marker in (("REJECT", "x"), ("FLAG", "!")):
        files = summary.get(verdict, [])
        if files:
            print(f"\n{verdict}:")
            for f in files:
                print(f"  {marker} {f}")
                for issue in summary.get("details", {}).get(f, []):
                    if verdict == "REJECT" and issue["severity"] != "critical":
                        continue
                    print(f"      - [{issue['severity']}] {issue['field']}: {issue['issue']}")

    if total:
        rate = len(summary.get("PASS", [])) / total * 100
        print(f"\nPass rate: {rate:.1f}%")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    summary = check_all()
    print_report(summary)
    # Hard gate: fail CI if any entry hits a banned/unregistered compound.
    sys.exit(1 if summary.get("REJECT") else 0)
