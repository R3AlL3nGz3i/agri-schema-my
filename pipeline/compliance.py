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

DESIGN STANCE — this gate FAILS CLOSED. If the banned denylist cannot be loaded,
`load_reference` raises rather than silently passing every entry.

MATCHING — the banned/restricted denylist is matched robustly against BOTH the
active `compound` and the `trade_name`, using token-subset + alias matching so
salt-form, hyphen, word-order, and mixture variants (e.g. "Paraquat dichloride",
"Parathion-methyl") do not slip through.

HONESTY — the registration allowlist is DISABLED until its `status` is
`authoritative`. Until real DOA / Lembaga Racun Makhluk Perosak data is supplied
and that flag is flipped, this gate is NOT authoritative for registration and
says so loudly in its report. The banned denylist and MRL/PHI checks are live.
"""
import re
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

# Formulation/salt words stripped when tokenising so "Paraquat dichloride"
# still matches the banned active "Paraquat".
_FILLER_TOKENS = {
    "dichloride", "chloride", "sulfate", "sulphate", "salt", "hydrochloride",
    "acid", "ester", "sodium", "potassium", "technical", "wp", "ec", "sc", "wg", "sl",
}


def _norm(name) -> str:
    return (name or "").strip().lower()


def _tokens(text) -> set:
    """Normalised, filler-stripped token set for robust active-ingredient matching."""
    raw = re.split(r"[\s\-/+,()]+", _norm(text))
    return {t for t in raw if t and t not in _FILLER_TOKENS}


def _issue(severity: str, field: str, issue: str, suggestion: str) -> dict:
    return {"severity": severity, "field": field, "issue": issue, "suggestion": suggestion}


def _verdict(issues: list) -> str:
    if any(i["severity"] == "critical" for i in issues):
        return "REJECT"
    if any(i["severity"] == "warning" for i in issues):
        return "FLAG"
    return "PASS"


def _parse_phi(value):
    """Return PHI as a number, or None if absent/unparseable. Never silently skips."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    m = re.search(r"\d+(\.\d+)?", str(value))
    return float(m.group()) if m else None


def _build_specs(raw_list) -> list:
    """Turn a banned/restricted YAML list into matchable specs (name forms + token sets)."""
    specs = []
    for x in raw_list or []:
        name = x.get("name")
        forms = [name] + list(x.get("aliases", []) or [])
        specs.append({
            "name": name,
            "reason": x.get("reason", ""),
            "token_sets": [_tokens(f) for f in forms if f],
        })
    return specs


def _matches(text, specs) -> dict:
    """Return the matching spec (or None). A spec matches if its token set is a
    subset of the text's tokens — order/salt-form/mixture tolerant."""
    text_tokens = _tokens(text)
    if not text_tokens:
        return None
    for spec in specs:
        for ts in spec["token_sets"]:
            if ts and ts <= text_tokens:
                return spec
    return None


def load_reference(ref_dir: Path = None) -> dict:
    """Load reference datasets. FAILS CLOSED: raises if the banned denylist is
    missing or unloadable, so an absent reference file can never open the gate."""
    if ref_dir is None:
        ref_dir = _REF_DIR

    banned_path = ref_dir / "banned_compounds.yaml"
    if not banned_path.exists():
        raise RuntimeError(
            f"FAIL-CLOSED: banned denylist not found at {banned_path}. "
            "Refusing to run the compliance gate without it."
        )
    banned_raw = yaml.safe_load(banned_path.read_text(encoding="utf-8"))
    if not isinstance(banned_raw, dict):
        raise RuntimeError(f"FAIL-CLOSED: {banned_path} is empty or malformed.")

    def _load_optional(name: str) -> dict:
        path = ref_dir / name
        if not path.exists():
            logger.warning(f"Reference file missing: {path}")
            return {}
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}

    return {
        "banned": _build_specs(banned_raw.get("banned")),
        "restricted": _build_specs(banned_raw.get("restricted")),
        "registry": _load_optional("registered_compounds.yaml"),
        "mrl": _load_optional("crop_mrl.yaml"),
    }


def registration_authoritative(reference: dict) -> bool:
    return reference.get("registry", {}).get("status") == "authoritative"


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

    authoritative = registration_authoritative(reference)
    approved_for_crop = {_norm(c) for c in (registry.get("approved", {}) or {}).get(crop, [])}

    treatments = disease.get("treatments") or []
    for i, t in enumerate(treatments):
        field = f"disease.treatments[{i}]"
        raw_name = t.get("compound")
        trade = t.get("trade_name")
        status = t.get("regulatory_status", "")

        # 1. Banned denylist (compound + trade_name) or schema banned status -> REJECT
        hit = _matches(raw_name, reference["banned"]) or _matches(trade, reference["banned"])
        if hit or status == "MY_banned":
            label = hit["name"] if hit else raw_name
            issues.append(_issue(
                "critical", f"{field}.compound",
                f"'{raw_name or trade}' matches banned/withdrawn active '{label}' in Malaysia",
                "Remove this treatment; substitute a registered alternative."))
        else:
            rhit = _matches(raw_name, reference["restricted"]) or _matches(trade, reference["restricted"])
            if rhit or status == "MY_restricted":
                label = rhit["name"] if rhit else raw_name
                issues.append(_issue(
                    "warning", f"{field}.compound",
                    f"'{raw_name or trade}' is restricted ('{label}') — export/residue risk",
                    "Confirm the approved use pattern before publishing."))

        # 2. Registration allowlist (only enforced when registry is authoritative)
        if authoritative:
            compound_norm = _norm(raw_name)
            if compound_norm and compound_norm not in approved_for_crop:
                issues.append(_issue(
                    "critical", f"{field}.compound",
                    f"'{raw_name}' is not registered for {entry.get('crop')} in the DOA registry",
                    "Off-label use is illegal; use a registered compound."))

        # 3. PHI adequacy on food crops
        if is_food:
            if t.get("phi_not_applicable"):
                # Method leaves no residue on the harvested part (soil drench, corm
                # dip, trunk injection, pre-plant fumigation, biocontrol). Skip the
                # PHI check — but require a reason so this is auditable, not a bypass.
                if not t.get("phi_not_applicable_reason"):
                    issues.append(_issue(
                        "warning", f"{field}.phi_not_applicable",
                        "phi_not_applicable set without phi_not_applicable_reason",
                        "State why PHI does not apply (e.g. corm dip / soil drench — "
                        "no residue on the harvested part)."))
            else:
                phi = _parse_phi(t.get("pre_harvest_interval_days"))
                if phi is None:
                    issues.append(_issue(
                        "warning", f"{field}.pre_harvest_interval_days",
                        "missing or unparseable pre-harvest interval on a food crop",
                        f"Add a numeric PHI >= {min_phi} days to clear residue limits."))
                elif phi < min_phi:
                    issues.append(_issue(
                        "warning", f"{field}.pre_harvest_interval_days",
                        f"PHI {phi}d is below the {min_phi}d minimum for {entry.get('crop')}",
                        "Raise the PHI or substitute a shorter-residue compound."))
                if t.get("phi_unverified"):
                    issues.append(_issue(
                        "warning", f"{field}.pre_harvest_interval_days",
                        "PHI value is a DRAFT, not yet verified against a DOA label / "
                        "MARDI source",
                        "A human agronomist must verify the PHI, then remove "
                        "phi_unverified."))

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
    """Run Layer 1 over all entries. Returns a verdict summary + per-file issues.
    FAILS CLOSED — propagates the load error if the denylist is unavailable."""
    if data_dir is None:
        data_dir = _PROJECT_ROOT / "data"
    reference = load_reference(ref_dir)  # raises if denylist missing (fail closed)

    summary = {
        "PASS": [], "FLAG": [], "REJECT": [], "errors": [], "details": {},
        "registration_authoritative": registration_authoritative(reference),
    }
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
    if not summary.get("registration_authoritative"):
        print("REGISTRATION: DISABLED (stub) — NOT AUTHORITATIVE.")
        print("  Supply DOA registration data and set status: authoritative to enforce.")
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


def gate_failed(summary: dict, strict: bool = False) -> bool:
    """CI/publish gate. Always fails on REJECT; in strict (publish) mode also on FLAG."""
    if summary.get("REJECT"):
        return True
    if strict and summary.get("FLAG"):
        return True
    return False


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Layer 1 compliance gate")
    parser.add_argument("--strict", action="store_true",
                        help="Publish mode: fail on FLAG as well as REJECT")
    args = parser.parse_args()

    summary = check_all()  # raises (fail closed) if the denylist is missing
    print_report(summary)
    sys.exit(1 if gate_failed(summary, strict=args.strict) else 0)
