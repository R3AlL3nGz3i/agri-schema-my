"""
mymrl.doa.gov.my fetcher — the PUBLIC Malaysian pesticide-residue portal.

Among the authority sources, the DOA's product-registration portals
(mypesticide.doa.gov.my, racunberdaftar) are login-gated, but the residue
portal at mymrl.doa.gov.my is PUBLIC. It publishes, per active ingredient x
food commodity:
  - TDMH (Tempoh Dilarang Mengutip Hasil) = the pre-harvest interval, in days,
  - MRLs (Jadual Keenam Belas / CODEX) in mg/kg,
  - registered trade products for that AI-commodity pair, with spray rates.

This module is a POLITE, RATE-LIMITED crawler that normalizes those into the
SAME CSV shape pipeline.doa_registry already ingests (REQUIRED_COLUMNS), so the
existing fail-closed ingest pipe consumes the output unchanged.

PROVENANCE CAVEAT (why this stays non-authoritative): mymrl carries NO product
registration number per crop use. Every emitted row therefore has a blank
`registration_no`, which makes doa_registry._validate_authoritative FAIL CLOSED
-> the registry is written `status: draft`, not `authoritative`. The data is
citable as a PHI/MRL source; it does NOT flip the registration gate on. That is
deliberate: spray rates here are keyed to the AI-commodity residue record, not a
full product-crop label dose, and there is no registration id to assert against.

Attribution: Jabatan Pertanian Malaysia (Department of Agriculture, Malaysia),
mymrl.doa.gov.my. Public residue reference; crawled at low rate with a
descriptive User-Agent and honoring per-request delay.

Design: the network layer is a thin, isolated shell; ALL parsing is pure
functions with no I/O, so the test suite runs fully offline against inline
fixtures (see tests/test_mymrl_fetcher.py).
"""
import csv
import html as _htmllib
import json
import logging
import re
import time
from datetime import date
from pathlib import Path

import requests

from pipeline.doa_registry import REQUIRED_COLUMNS

logger = logging.getLogger(__name__)

_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent
_REF_DIR = _PROJECT_ROOT / "data" / "reference"

BASE_URL = "https://mymrl.doa.gov.my"
# Default landing for the normalized export (gitignored sources dir the DOA
# ingest reads from). Kept distinct from the login-gated doa_registry_raw.csv.
DEFAULT_OUT = _REF_DIR / "sources" / "mymrl_raw.csv"

USER_AGENT = (
    "AgriSchema-MY/1.0 (open crop-disease KB; polite residue-data fetch; "
    "contact via github.com/agri-schema-my)"
)
REQUEST_DELAY = 1.0  # seconds between requests — be a good citizen

APPROVAL_STATUS = "mymrl_listed"  # not a registration status; a source tag


# ---------------------------------------------------------------------------
# Pure parsers (no network) — the tested core.
# ---------------------------------------------------------------------------

def _unescape(s: str) -> str:
    return _htmllib.unescape((s or "").strip())


def parse_ai_options(page_html: str) -> dict[int, str]:
    """Map every active-ingredient id -> name from the 'Choose reference' select.

    That dropdown is the canonical enumeration of AI detail pages (/AIs/{id}).
    The pesticide-type and MOA selects also use numeric option values, so we
    isolate the reference select by its placeholder before extracting options.
    """
    marker = page_html.find("-- Choose reference --")
    if marker == -1:
        return {}
    start = page_html.rfind("<select", 0, marker)
    end = page_html.find("</select>", marker)
    if start == -1 or end == -1:
        return {}
    block = page_html[start:end]
    out: dict[int, str] = {}
    for m in re.finditer(r'<option value="(\d+)"[^>]*>([^<]+)</option>', block):
        aid = int(m.group(1))
        name = _unescape(m.group(2))
        if aid > 0 and name and not name.startswith("--"):
            out[aid] = name
    return out


def parse_ai_name(page_html: str) -> str | None:
    """AI name from the detail-page heading `<h5 class="mb-1">{name} - {type}</h5>`.

    Falls back to None if absent (caller can use the enumeration map instead).
    """
    m = re.search(r'<h5 class="mb-1">(.*?)</h5>', page_html, re.S)
    if not m:
        return None
    text = _unescape(re.sub(r"<[^>]+>", "", m.group(1)))
    # Heading is "{active ingredient} - {pesticide type}"; keep the AI part.
    return text.split(" - ")[0].strip() or None


def _cell_text(td: str) -> str:
    return _unescape(re.sub(r"<[^>]+>", "", td))


def parse_commodity_rows(page_html: str) -> list[dict]:
    """Parse the residue table into per-commodity rows.

    Each `<tr data-cid data-id>` yields:
      {aicid, commodity_id, commodity, mrl_schedule, mrl_codex, phi_days, notes}
    where aicid (data-id) keys the per-commodity product endpoint and phi_days is
    the TDMH column ('-' or blank -> "").
    """
    rows: list[dict] = []
    tr_re = re.compile(
        r'<tr\s+data-cid="(\d+)"\s+data-id="(\d+)"\s*>(.*?)</tr>', re.S)
    td_re = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
    for tr in tr_re.finditer(page_html):
        cid, aicid, body = tr.group(1), tr.group(2), tr.group(3)
        tds = [_cell_text(t) for t in td_re.findall(body)]
        if len(tds) < 5:
            continue
        commodity, mrl_sched, mrl_codex, tdmh, notes = tds[0], tds[1], tds[2], tds[3], tds[4]
        phi = "" if tdmh in ("-", "") else tdmh
        rows.append({
            "aicid": int(aicid),
            "commodity_id": int(cid),
            "commodity": commodity,
            "mrl_schedule": mrl_sched,
            "mrl_codex": mrl_codex,
            "phi_days": phi,
            "notes": notes,
        })
    return rows


def parse_products_json(text: str) -> list[dict]:
    """Parse the handler=Product JSON into [{trade_name, spray_rate, notes}]."""
    try:
        data = json.loads(text or "[]")
    except json.JSONDecodeError:
        return []
    out = []
    for p in data if isinstance(data, list) else []:
        rate = p.get("sprayRate")
        out.append({
            "trade_name": (p.get("name") or "").strip(),
            "spray_rate": "" if rate in (None, 0) else str(rate),
            "notes": (p.get("notes") or "").strip(),
        })
    return out


def build_csv_rows(ai_name: str, commodity_rows: list[dict],
                   products_by_aicid: dict[int, list[dict]],
                   source_url: str, retrieved_date: str) -> list[dict]:
    """Normalize one AI's residue records into DOA-CSV rows (REQUIRED_COLUMNS).

    One row per registered product; a commodity with no listed product still
    yields a single PHI/MRL-bearing row (blank trade_name/dosage). `crop` keeps
    the raw Malay commodity name — mapping to KB crop slugs is a later,
    reviewable step, not guessed here. `registration_no` is always blank (mymrl
    has none) so the downstream ingest fails closed to `draft`.
    """
    out: list[dict] = []
    for row in commodity_rows:
        products = products_by_aicid.get(row["aicid"], [])
        base = {
            "active_ingredient": ai_name,
            "crop": row["commodity"],
            "target": "",  # mymrl is a residue table, not a target-pest table
            "phi_days": row["phi_days"],
            "registration_no": "",  # none in mymrl -> keeps ingest non-authoritative
            "approval_status": APPROVAL_STATUS,
            "source_url": source_url,
            "retrieved_date": retrieved_date,
        }
        if products:
            for p in products:
                out.append({**base,
                            "trade_name": p["trade_name"],
                            "dosage": p["spray_rate"]})
        else:
            out.append({**base, "trade_name": "", "dosage": ""})
    return out


# ---------------------------------------------------------------------------
# Network layer (thin shell around the pure parsers).
# ---------------------------------------------------------------------------

def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def _get(session: requests.Session, url: str, delay: float) -> str:
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    if delay:
        time.sleep(delay)
    return resp.text


def fetch_ai_index(session: requests.Session, delay: float = REQUEST_DELAY) -> dict[int, str]:
    """Fetch any detail page and read its reference dropdown to enumerate AIs."""
    return parse_ai_options(_get(session, f"{BASE_URL}/AIs/1", delay))


def fetch_products(session: requests.Session, aicid: int, delay: float = REQUEST_DELAY) -> list[dict]:
    url = f"{BASE_URL}/AIs/1?aicid={aicid}&handler=Product"
    return parse_products_json(_get(session, url, delay))


def fetch_ai_rows(session: requests.Session, ai_id: int, fallback_name: str,
                  delay: float = REQUEST_DELAY, with_products: bool = True) -> list[dict]:
    """Crawl one AI detail page (+ its product endpoints) -> DOA-CSV rows."""
    source_url = f"{BASE_URL}/AIs/{ai_id}"
    page = _get(session, source_url, delay)
    ai_name = parse_ai_name(page) or fallback_name
    commodity_rows = parse_commodity_rows(page)
    products_by_aicid: dict[int, list[dict]] = {}
    if with_products:
        for row in commodity_rows:
            aicid = row["aicid"]
            if aicid not in products_by_aicid:
                products_by_aicid[aicid] = fetch_products(session, aicid, delay)
    return build_csv_rows(ai_name, commodity_rows, products_by_aicid,
                          source_url, date.today().isoformat())


def crawl(out_csv: Path = DEFAULT_OUT, limit: int | None = None,
          delay: float = REQUEST_DELAY, with_products: bool = True) -> dict:
    """Crawl mymrl into a DOA-shaped CSV. Returns a summary dict.

    `limit` caps the number of AIs (for a polite prototype run). Network errors
    on a single AI are logged and skipped rather than aborting the whole crawl.
    """
    out_csv = Path(out_csv)
    session = _make_session()
    index = fetch_ai_index(session, delay)
    ai_ids = sorted(index)[:limit] if limit else sorted(index)
    logger.info(f"mymrl: enumerated {len(index)} AIs; crawling {len(ai_ids)}")

    all_rows: list[dict] = []
    errors = 0
    for ai_id in ai_ids:
        try:
            rows = fetch_ai_rows(session, ai_id, index[ai_id], delay, with_products)
            all_rows.extend(rows)
            logger.info(f"mymrl AI {ai_id} ({index[ai_id]}): {len(rows)} rows")
        except requests.RequestException as e:
            errors += 1
            logger.warning(f"mymrl AI {ai_id} ({index[ai_id]}) failed: {e}")

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(REQUIRED_COLUMNS))
        w.writeheader()
        w.writerows(all_rows)

    logger.info(f"mymrl: wrote {len(all_rows)} rows -> {out_csv} "
                f"({len(ai_ids) - errors}/{len(ai_ids)} AIs ok)")
    return {
        "out_csv": str(out_csv),
        "ais_total": len(index),
        "ais_crawled": len(ai_ids),
        "ais_failed": errors,
        "rows": len(all_rows),
    }


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    ap = argparse.ArgumentParser(description="Crawl mymrl.doa.gov.my into a DOA-shaped CSV")
    ap.add_argument("--limit", type=int, default=None, help="cap number of AIs (polite run)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output CSV path")
    ap.add_argument("--delay", type=float, default=REQUEST_DELAY, help="seconds between requests")
    ap.add_argument("--no-products", action="store_true", help="skip trade-product spray rates")
    args = ap.parse_args()
    summary = crawl(args.out, limit=args.limit, delay=args.delay,
                    with_products=not args.no_products)
    print("mymrl crawl:", summary)
    print("Next: feed into the DOA ingest (stays draft — no registration_no):")
    print(f"  python -c 'from pipeline.doa_registry import ingest_doa_registry; "
          f"print(ingest_doa_registry(\"{summary['out_csv']}\"))'")
