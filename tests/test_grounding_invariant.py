"""Anti-authority-washing invariant tests over the REAL knowledge base.

Fully offline + deterministic: reads the committed data/crops/**/*.yaml and the
committed reference registry. No network, no API, no fixtures.

The lock this enforces: a treatment may claim `verified: true` ONLY when a real
authoritative source backs it. An LLM (seed generator / professor agent) can
write any prose it likes, but it can never earn a `verified: true` that these
tests would not also grant. Concretely:

  * dosage_grounding.verified may be true ONLY if the DOA product registry
    (doa_products.yaml, status: authoritative) carries a registration_no for
    that (crop, compound). No public label-dose source exists yet, so today
    this means every dose stays verified: false.
  * phi_grounding.verified may be true ONLY with a source on a doa.gov.my
    domain (the public mymrl residue portal). Foreign/APVMA or null sources
    cannot be 'verified'.

Run: python tests/test_grounding_invariant.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yaml

from pipeline.doa_registry import load_commodity_to_slug

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
REF_DIR = DATA_DIR / "reference"
PRODUCTS_PATH = REF_DIR / "doa_products.yaml"

# A source that grounds a Malaysian-government verification. Bare strings like
# "mymrl.doa.gov.my/AIs/100" (no scheme) must match, so this is a domain
# substring check, not urlparse.
_MY_GOV = re.compile(r"(^|\.)doa\.gov\.my", re.IGNORECASE)


def _norm(s) -> str:
    return (s or "").strip().lower()


def _iter_treatments():
    """Yield (field_label, crop_slug, treatment_dict) for every real treatment."""
    for yaml_file in sorted(DATA_DIR.glob("crops/**/diseases/*.yaml")):
        entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8")) or {}
        crop = _norm(entry.get("crop"))
        disease = entry.get("disease") or {}
        for i, t in enumerate(disease.get("treatments") or []):
            yield (f"{yaml_file.name}:treatments[{i}]", crop, t)


def _iter_entries():
    """Yield (filename, disease_dict) for every real disease entry."""
    for yaml_file in sorted(DATA_DIR.glob("crops/**/diseases/*.yaml")):
        entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8")) or {}
        yield (yaml_file.name, entry.get("disease") or {})


# Canonical dose-on-label caveat, whitespace-normalized. Because doses are
# AI estimates, farmer-facing text must always route the farmer to the label
# (the legal source of truth) to confirm the actual dose.
def _flat(s) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


_CAVEAT_BM = "sahkan dos sebenar pada label produk berdaftar"
_CAVEAT_EN = "confirm the actual dose on the registered product label"


def _registry_backed_pairs() -> set:
    """(crop_slug, compound_norm) pairs the AUTHORITATIVE registry can back.

    Empty unless doa_products.yaml exists AND status == authoritative AND the row
    carries a registration_no. The committed stub is draft/empty -> empty set."""
    if not PRODUCTS_PATH.exists():
        return set()
    pdata = yaml.safe_load(PRODUCTS_PATH.read_text(encoding="utf-8")) or {}
    if pdata.get("status") != "authoritative":
        return set()
    commodity_to_slug = load_commodity_to_slug()
    backed = set()
    for p in pdata.get("products", []):
        if not str(p.get("registration_no", "")).strip():
            continue
        crop_key = _norm(p.get("crop"))
        crop_key = commodity_to_slug.get(crop_key, crop_key)
        backed.add((crop_key, _norm(p.get("compound"))))
    return backed


# --------------------------------------------------------------------------- #

def test_no_dose_verified_without_registry_backing():
    """dosage_grounding.verified: true is forbidden unless a registration-backed
    registry record exists for that (crop, compound)."""
    backed = _registry_backed_pairs()
    offenders = []
    for label, crop, t in _iter_treatments():
        dg = t.get("dosage_grounding") or {}
        if dg.get("verified") is True and (crop, _norm(t.get("compound"))) not in backed:
            offenders.append(f"{label} compound={t.get('compound')!r}")
    assert not offenders, (
        "dose verified:true without a registration-backed registry record "
        "(authority-washing): " + "; ".join(offenders))


def test_every_treatment_carries_dose_honesty_label():
    """Every treatment must keep a dosage_grounding block whose verified is
    explicitly False — the honesty label must never be silently dropped."""
    missing = []
    for label, _crop, t in _iter_treatments():
        dg = t.get("dosage_grounding")
        if not isinstance(dg, dict) or "verified" not in dg:
            missing.append(f"{label}: no dosage_grounding.verified")
        elif dg.get("verified") is not False:
            missing.append(f"{label}: dosage_grounding.verified={dg.get('verified')!r}")
    assert not missing, "missing/invalid dose honesty label: " + "; ".join(missing)


def test_phi_verified_requires_my_gov_source():
    """phi_grounding.verified: true is forbidden unless source is on doa.gov.my."""
    offenders = []
    for label, _crop, t in _iter_treatments():
        pg = t.get("phi_grounding") or {}
        if pg.get("verified") is True:
            src = pg.get("source") or ""
            if not _MY_GOV.search(str(src)):
                offenders.append(f"{label}: source={src!r}")
    assert not offenders, (
        "phi verified:true without a doa.gov.my source: " + "; ".join(offenders))


def test_phi_verified_and_status_agree():
    """verified is true exactly when status is 'verified'; not_applicable and
    unverified statuses must carry verified: false."""
    bad = []
    for label, _crop, t in _iter_treatments():
        pg = t.get("phi_grounding")
        if not isinstance(pg, dict):
            continue
        verified = pg.get("verified") is True
        status = _norm(pg.get("status"))
        if verified != (status == "verified"):
            bad.append(f"{label}: verified={pg.get('verified')!r} status={status!r}")
    assert not bad, "phi verified/status disagreement: " + "; ".join(bad)


def test_no_verified_phi_also_flagged_unverified():
    """A treatment cannot be phi_grounding.verified: true and still carry the
    legacy phi_unverified: true draft flag."""
    conflicts = []
    for label, _crop, t in _iter_treatments():
        pg = t.get("phi_grounding") or {}
        if pg.get("verified") is True and t.get("phi_unverified") is True:
            conflicts.append(label)
    assert not conflicts, ("verified phi still flagged phi_unverified: "
                           + "; ".join(conflicts))


def test_farmer_text_carries_dose_label_caveat():
    """Every entry's farmer-facing instructions_bm (BM) and application must tell
    the farmer to confirm the actual dose on the registered product label. Doses
    here are AI estimates, so the label is the legal source of truth."""
    missing = []
    for name, disease in _iter_entries():
        ib = _flat(disease.get("instructions_bm"))
        ap = _flat(disease.get("application"))
        if _CAVEAT_BM not in ib:
            missing.append(f"{name}:instructions_bm")
        if _CAVEAT_BM not in ap and _CAVEAT_EN not in ap:
            missing.append(f"{name}:application")
    assert not missing, "farmer text missing dose-on-label caveat: " + "; ".join(missing)


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
