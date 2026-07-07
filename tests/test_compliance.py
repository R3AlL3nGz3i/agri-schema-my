"""Tests for the Layer 1 deterministic compliance gate (pipeline/compliance.py)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.compliance import check_entry, load_reference

REF = load_reference()


def _entry(**treatment_overrides):
    """A clean, fully-populated paddy entry; override one treatment field per test."""
    treatment = {
        "compound": "Tricyclazole",
        "dosage": "0.5g per litre water",
        "regulatory_status": "MY_approved",
        "pre_harvest_interval_days": 14,
    }
    treatment.update(treatment_overrides)
    return {
        "crop": "paddy",
        "disease": {
            "treatments": [treatment],
            "rotation_partner": "Isoprothiolane (different FRAC group)",
            "application": "foliar spray, avoid before rain, wear PPE",
            "instructions_bm": "Sembur pada daun pada tanda awal jangkitan.",
            "cultural_controls": ["resistant varieties", "field sanitation"],
        },
    }


def test_clean_entry_passes():
    assert check_entry(_entry(), REF)["verdict"] == "PASS"


def test_banned_compound_rejects():
    assert check_entry(_entry(compound="Paraquat"), REF)["verdict"] == "REJECT"


def test_banned_status_rejects():
    assert check_entry(_entry(regulatory_status="MY_banned"), REF)["verdict"] == "REJECT"


def test_restricted_compound_flags():
    assert check_entry(_entry(compound="Chlorpyrifos"), REF)["verdict"] == "FLAG"


def test_short_phi_flags():
    assert check_entry(_entry(pre_harvest_interval_days=1), REF)["verdict"] == "FLAG"


def test_missing_phi_on_food_crop_flags():
    assert check_entry(_entry(pre_harvest_interval_days=None), REF)["verdict"] == "FLAG"


def test_missing_practicality_field_flags():
    entry = _entry()
    del entry["disease"]["instructions_bm"]
    assert check_entry(entry, REF)["verdict"] == "FLAG"


def test_non_food_crop_skips_phi_check():
    entry = {
        "crop": "rubber",
        "disease": {
            "treatments": [{"compound": "Hexaconazole", "dosage": "1ml/L",
                            "regulatory_status": "MY_approved",
                            "pre_harvest_interval_days": None}],
            "rotation_partner": "x", "application": "y",
            "instructions_bm": "z", "cultural_controls": ["a"],
        },
    }
    # Null PHI on a non-food crop must NOT flag (exempt); entry should pass.
    assert check_entry(entry, REF)["verdict"] == "PASS"


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
