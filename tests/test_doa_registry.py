"""Tests for the DOA registry ingestion module (pipeline/doa_registry.py).

Fully offline + deterministic: synthetic CSV fixtures, temp dirs, no network.
Also exercises the integration point — once the registry is `authoritative`,
compliance.check_entry must REJECT an off-label (unregistered) compound.
Run: python tests/test_doa_registry.py
"""
import sys
import csv
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yaml

from pipeline import doa_registry as dr
from pipeline import compliance

# Columns in order.
COLS = list(dr.REQUIRED_COLUMNS)

# Three registered product-crop uses on an allow-listed MY gov domain.
GOOD_ROWS = [
    ["Tricyclazole", "Beam 75WP", "paddy", "rice blast", "0.5 g/L", "21",
     "MY-REG-001", "approved", "https://mypesticide.doa.gov.my/p/1", "2026-07-01"],
    ["Isoprothiolane", "Fuji-One", "paddy", "rice blast", "1 L/ha", "14",
     "MY-REG-002", "approved", "https://mypesticide.doa.gov.my/p/2", "2026-07-01"],
    ["Azoxystrobin", "Amistar", "chilli", "anthracnose", "1 mL/L", "7",
     "MY-REG-003", "approved", "https://mypesticide.doa.gov.my/p/3", "2026-07-01"],
]


def _write_csv(path: Path, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLS)
        w.writerows(rows)


def _tmp():
    return Path(tempfile.mkdtemp())


# ---------------------------------------------------------------------------

def test_clean_source_is_authoritative():
    out = _tmp()
    src = out / "raw.csv"
    _write_csv(src, GOOD_ROWS)
    summary = dr.ingest_doa_registry(src, out_dir=out)
    assert summary["written"] is True
    assert summary["status"] == "authoritative"
    reg = yaml.safe_load((out / dr.REGISTRY_OUT).read_text())
    assert reg["status"] == "authoritative"
    assert reg["approved"] == {"paddy": ["Isoprothiolane", "Tricyclazole"],
                               "chilli": ["Azoxystrobin"]}
    prods = yaml.safe_load((out / dr.PRODUCTS_OUT).read_text())
    assert len(prods["products"]) == 3


def test_missing_registration_no_stays_draft():
    out = _tmp()
    rows = [r[:] for r in GOOD_ROWS]
    rows[1][6] = ""  # blank registration_no
    src = out / "raw.csv"
    _write_csv(src, rows)
    summary = dr.ingest_doa_registry(src, out_dir=out)
    assert summary["status"] == "draft"          # fail-closed
    reg = yaml.safe_load((out / dr.REGISTRY_OUT).read_text())
    assert reg["status"] == "draft"


def test_foreign_source_domain_rejected():
    out = _tmp()
    rows = [r[:] for r in GOOD_ROWS]
    rows[0][8] = "https://example.com/label"   # not a MY gov domain
    src = out / "raw.csv"
    _write_csv(src, rows)
    summary = dr.ingest_doa_registry(src, out_dir=out)
    assert summary["status"] == "draft"
    assert any("allow-listed" in r for r in summary["provenance_reasons"])


def test_allow_authoritative_false_forces_draft():
    out = _tmp()
    src = out / "raw.csv"
    _write_csv(src, GOOD_ROWS)
    summary = dr.ingest_doa_registry(src, out_dir=out, allow_authoritative=False)
    assert summary["status"] == "draft"          # opt-out even on clean data


def test_no_source_writes_nothing():
    out = _tmp()
    summary = dr.ingest_doa_registry(out / "absent.csv", out_dir=out)
    assert summary["written"] is False
    assert not (out / dr.REGISTRY_OUT).exists()   # committed stub never clobbered


def test_missing_columns_raises():
    out = _tmp()
    src = out / "raw.csv"
    with src.open("w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerow(["active_ingredient", "crop"])  # incomplete header
    try:
        dr.parse_registry_csv(src)
        assert False, "should raise on missing columns"
    except ValueError as e:
        assert "missing columns" in str(e)


def _min_ref_dir(registry_path: Path) -> Path:
    """Build a compliance ref dir: minimal banned list + the generated registry."""
    ref = _tmp()
    (ref / "banned_compounds.yaml").write_text(
        yaml.dump({"banned": [{"name": "Paraquat"}], "restricted": []}), encoding="utf-8")
    (ref / dr.REGISTRY_OUT).write_text(registry_path.read_text(), encoding="utf-8")
    return ref


def _entry(compound):
    return {"crop": "paddy", "disease": {"name": "rice_blast", "treatments": [
        {"compound": compound, "dosage": "0.5 g/L", "regulatory_status": "MY_approved",
         "pre_harvest_interval_days": 21}]}}


def test_authoritative_registry_rejects_off_label():
    out = _tmp()
    src = out / "raw.csv"
    _write_csv(src, GOOD_ROWS)
    dr.ingest_doa_registry(src, out_dir=out)
    ref_dir = _min_ref_dir(out / dr.REGISTRY_OUT)
    reference = compliance.load_reference(ref_dir)
    assert compliance.registration_authoritative(reference) is True

    # Unregistered (but not banned) compound for paddy -> off-label REJECT.
    off = compliance.check_entry(_entry("Chlorothalonil"), reference)
    assert off["verdict"] == "REJECT"
    assert any("not registered" in i["issue"] for i in off["issues"])

    # Registered compound -> no registration issue.
    ok = compliance.check_entry(_entry("Tricyclazole"), reference)
    assert not any("not registered" in i["issue"] for i in ok["issues"])


def test_audit_reconciles_entries():
    out = _tmp()
    src = out / "raw.csv"
    _write_csv(src, GOOD_ROWS)
    dr.ingest_doa_registry(src, out_dir=out)

    data = _tmp()
    d = data / "crops" / "paddy" / "diseases"
    d.mkdir(parents=True)
    (d / "x.yaml").write_text(yaml.dump(_entry("Tricyclazole")), encoding="utf-8")
    (d / "y.yaml").write_text(yaml.dump(_entry("Mancozeb")), encoding="utf-8")

    audit = dr.audit_entries_against_registry(data_dir=data, products_path=out / dr.PRODUCTS_OUT)
    assert audit["available"] is True
    by_comp = {f["compound"]: f["status"] for f in audit["findings"]}
    assert by_comp["Tricyclazole"] == "registered"
    assert by_comp["Mancozeb"] == "off_label_or_uncatalogued"


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
