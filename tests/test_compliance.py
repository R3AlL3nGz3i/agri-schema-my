"""Tests for the Layer 1 deterministic compliance gate (pipeline/compliance.py)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.compliance import check_entry, load_reference, gate_failed

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


def test_banned_salt_form_variant_rejects():
    # "Paraquat dichloride" must match banned "Paraquat" via token-subset matching.
    assert check_entry(_entry(compound="Paraquat dichloride"), REF)["verdict"] == "REJECT"


def test_banned_hyphen_order_variant_rejects():
    # "Parathion-methyl" must match banned "Methyl parathion".
    assert check_entry(_entry(compound="Parathion-methyl"), REF)["verdict"] == "REJECT"


def test_banned_in_trade_name_rejects():
    # A banned active hidden in trade_name must still be caught.
    e = _entry(compound="Mancozeb", trade_name="Gramoxone 200SL")
    assert check_entry(e, REF)["verdict"] == "REJECT"


def test_string_phi_below_minimum_flags():
    assert check_entry(_entry(pre_harvest_interval_days="3 days"), REF)["verdict"] == "FLAG"


def test_fail_closed_when_denylist_missing():
    try:
        load_reference(ref_dir=Path("/nonexistent/reference/dir"))
    except RuntimeError:
        return
    raise AssertionError("load_reference must fail closed when denylist is missing")


def test_strict_mode_blocks_on_flag():
    assert gate_failed({"REJECT": [], "FLAG": ["x"]}, strict=True) is True
    assert gate_failed({"REJECT": [], "FLAG": ["x"]}, strict=False) is False
    assert gate_failed({"REJECT": ["y"], "FLAG": []}, strict=False) is True


def test_phi_not_applicable_with_reason_passes():
    e = _entry(pre_harvest_interval_days=None, phi_not_applicable=True,
               phi_not_applicable_reason="soil drench — no residue on fruit")
    assert check_entry(e, REF)["verdict"] == "PASS"


def test_phi_not_applicable_without_reason_flags():
    e = _entry(pre_harvest_interval_days=None, phi_not_applicable=True)
    assert check_entry(e, REF)["verdict"] == "FLAG"


def test_phi_unverified_draft_flags():
    # A drafted-but-adequate PHI must still FLAG until a human verifies it.
    e = _entry(pre_harvest_interval_days=14, phi_unverified=True)
    assert check_entry(e, REF)["verdict"] == "FLAG"


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
