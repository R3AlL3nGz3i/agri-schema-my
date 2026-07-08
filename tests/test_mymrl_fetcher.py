"""Tests for the mymrl.doa.gov.my fetcher (pipeline/mymrl_fetcher.py).

Fully offline + deterministic: inline HTML/JSON fixtures modeled on the real
mymrl markup, a fake requests.Session, temp dirs — no network. Verifies the
pure parsers, the DOA-CSV normalization, the fail-closed provenance link (mymrl
rows carry no registration_no -> doa_registry ingest stays `draft`), and that a
single AI network error is skipped, not fatal.
Run: python tests/test_mymrl_fetcher.py
"""
import sys
import csv
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests

from pipeline import mymrl_fetcher as mf
from pipeline import doa_registry as dr

# --- Fixtures modeled on real mymrl markup --------------------------------

# Detail page: reference dropdown (AI enumeration) + heading + residue table.
AI_PAGE = """
<html><body>
<h4 class="text-capitalize mb-4"><b>Perawis Aktif</b></h4>
<select id="AICId">
  <option value="0" disable selected>-- Choose reference --</option>
  <option value="1">2,4-D</option>
  <option value="2">Abamectin</option>
  <option value="7">Azoxystrobin</option>
</select>
<h5 class="mb-1">2,4-D - Racun rumpai </h5>
<table class="table">
  <thead><tr><th>Komoditi</th><th>Jadual</th><th>CODEX</th><th>TDMH</th><th>Catatan</th></tr></thead>
  <tbody>
    <tr data-cid="6" data-id="1">
      <td><a href="/Commodities/6">Beras Kilang</a> </td>
      <td class="text-center">0.1</td>
      <td class="text-center"></td>
      <td class="text-center">-</td>
      <td></td>
    </tr>
    <tr data-cid="44" data-id="5">
      <td><a href="/Commodities/44">Pisang</a> </td>
      <td class="text-center">0.1</td>
      <td class="text-center"></td>
      <td class="text-center">14</td>
      <td>catatan</td>
    </tr>
  </tbody>
</table>
</body></html>
"""

# handler=Product JSON per aicid.
PRODUCTS = {
    1: '[{"id":329,"name":"SPPM Amine 720","sprayRate":600,"perSeason":0,'
       '"perDay":0,"notes":"Renew","aiCommodityId":1}]',
    5: '[{"id":700,"name":"Banana Guard 50","sprayRate":0,"notes":"","aiCommodityId":5}]',
}


class FakeSession:
    """Minimal stand-in for requests.Session that serves the fixtures."""
    def __init__(self, fail_on=None):
        self.headers = {}
        self.fail_on = fail_on or set()
        self.calls = []

    def get(self, url, timeout=None):
        self.calls.append(url)
        if any(f in url for f in self.fail_on):
            raise requests.RequestException(f"boom: {url}")
        if "handler=Product" in url:
            aicid = int(url.split("aicid=")[1].split("&")[0])
            return _Resp(PRODUCTS.get(aicid, "[]"))
        return _Resp(AI_PAGE)


class _Resp:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        pass


# --- Parser tests ----------------------------------------------------------

def test_parse_ai_options():
    opts = mf.parse_ai_options(AI_PAGE)
    assert opts == {1: "2,4-D", 2: "Abamectin", 7: "Azoxystrobin"}


def test_parse_ai_name_strips_type():
    assert mf.parse_ai_name(AI_PAGE) == "2,4-D"


def test_parse_commodity_rows():
    rows = mf.parse_commodity_rows(AI_PAGE)
    assert len(rows) == 2
    r0, r1 = rows
    assert r0["commodity"] == "Beras Kilang"
    assert r0["aicid"] == 1
    assert r0["phi_days"] == ""          # '-' normalized to blank
    assert r1["commodity"] == "Pisang"
    assert r1["phi_days"] == "14"        # TDMH preserved
    assert r1["mrl_schedule"] == "0.1"


def test_parse_products_json():
    prods = mf.parse_products_json(PRODUCTS[1])
    assert prods == [{"trade_name": "SPPM Amine 720", "spray_rate": "600", "notes": "Renew"}]
    # sprayRate 0 -> blank
    assert mf.parse_products_json(PRODUCTS[5])[0]["spray_rate"] == ""
    assert mf.parse_products_json("not json") == []


def test_build_csv_rows_shape_and_blank_registration():
    rows = mf.parse_commodity_rows(AI_PAGE)
    by_aicid = {1: mf.parse_products_json(PRODUCTS[1]),
                5: mf.parse_products_json(PRODUCTS[5])}
    out = mf.build_csv_rows("2,4-D", rows, by_aicid,
                            "https://mymrl.doa.gov.my/AIs/1", "2026-07-08")
    # Every DOA required column present, registration_no always blank.
    for r in out:
        assert set(r) == set(dr.REQUIRED_COLUMNS)
        assert r["registration_no"] == ""
    beras = next(r for r in out if r["crop"] == "Beras Kilang")
    assert beras["trade_name"] == "SPPM Amine 720"
    assert beras["dosage"] == "600"
    assert beras["active_ingredient"] == "2,4-D"
    # Product with sprayRate 0 -> row still emitted, blank dosage, PHI kept.
    pisang = next(r for r in out if r["crop"] == "Pisang")
    assert pisang["dosage"] == ""
    assert pisang["phi_days"] == "14"


def test_commodity_without_products_still_yields_row():
    rows = mf.parse_commodity_rows(AI_PAGE)
    out = mf.build_csv_rows("2,4-D", rows, {},  # no products at all
                            "https://mymrl.doa.gov.my/AIs/1", "2026-07-08")
    assert len(out) == 2
    assert all(r["trade_name"] == "" and r["dosage"] == "" for r in out)
    assert {r["phi_days"] for r in out} == {"", "14"}


# --- Network-shell tests (fake session, no I/O) ----------------------------

def test_fetch_ai_index():
    s = FakeSession()
    assert mf.fetch_ai_index(s, delay=0) == {1: "2,4-D", 2: "Abamectin", 7: "Azoxystrobin"}


def test_fetch_ai_rows_end_to_end():
    s = FakeSession()
    rows = mf.fetch_ai_rows(s, 1, "fallback", delay=0)
    assert len(rows) == 2
    beras = next(r for r in rows if r["crop"] == "Beras Kilang")
    assert beras["dosage"] == "600"
    assert beras["source_url"] == "https://mymrl.doa.gov.my/AIs/1"


def test_crawl_writes_csv_and_skips_failed_ai(monkeypatch=None):
    s = FakeSession(fail_on={"/AIs/2"})  # AI 2's detail page errors
    monkeypatch_session(s)
    out = Path(tempfile.mkdtemp()) / "mymrl_raw.csv"
    summary = mf.crawl(out_csv=out, limit=2, delay=0)  # AIs 1 and 2
    assert summary["ais_crawled"] == 2
    assert summary["ais_failed"] == 1        # AI 2 skipped, not fatal
    assert summary["rows"] == 2              # only AI 1's rows written
    with out.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == list(dr.REQUIRED_COLUMNS)
        assert len(list(reader)) == 2


def test_mymrl_csv_ingests_as_draft():
    """The provenance contract: mymrl output has no registration_no, so the DOA
    ingest MUST refuse to mark it authoritative and stay `draft` (fail-closed)."""
    s = FakeSession()
    monkeypatch_session(s)
    out = Path(tempfile.mkdtemp()) / "mymrl_raw.csv"
    mf.crawl(out_csv=out, limit=1, delay=0)
    ing_out = Path(tempfile.mkdtemp())
    summary = dr.ingest_doa_registry(out, out_dir=ing_out)
    assert summary["written"] is True
    assert summary["status"] == "draft"      # never authoritative from mymrl
    assert any("registration_no" in r for r in summary["provenance_reasons"])


# monkeypatch helper: swap the session factory so crawl() uses our fake.
_ORIG_MAKE = mf._make_session


def monkeypatch_session(fake):
    mf._make_session = lambda: fake


def _restore():
    mf._make_session = _ORIG_MAKE


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
        finally:
            _restore()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
