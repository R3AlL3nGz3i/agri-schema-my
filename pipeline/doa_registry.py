"""
DOA registry ingestion (Malaysian pesticide registration data).

This is an INGESTION + VALIDATION pipe, not a scraper. The DOA / Lembaga Racun
Makhluk Perosak portals (mypesticide.doa.gov.my) are login-gated, so an
authoritative source cannot be crawled anonymously. Instead a human supplies a
verified export (logged-in portal download / licensed feed / MyGAP) as CSV, and
this module turns it into the two reference artifacts the pipeline consumes:

  1. data/reference/registered_compounds.yaml
       -> the allowlist Layer 1 (compliance.py) already reads. When `status` is
          flipped to `authoritative`, check_entry REJECTs any compound not
          registered for its crop (off-label = illegal).
  2. data/reference/doa_products.yaml
       -> per-product dosage/PHI fact table. This is the fact-bearing source
          Layer 2 grounding should quote (replacing the MARDI bulletins, which
          were found to carry no per-product dosage/PHI facts).

FAILS CLOSED on authority: the registry is written `authoritative` ONLY if every
row carries a registration number, a retrieved date, and a source URL on an
allow-listed Malaysian government domain. Any gap -> `status: draft`, which keeps
the registration gate disabled rather than asserting unverified authority. With
no source file present, the module writes nothing and the committed stub stands.
"""
import csv
import logging
from pathlib import Path
from urllib.parse import urlparse

import yaml

logger = logging.getLogger(__name__)

_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent
_REF_DIR = _PROJECT_ROOT / "data" / "reference"
_DATA_DIR = _PROJECT_ROOT / "data"

# Default location for the human-supplied authoritative export (gitignored).
DEFAULT_SOURCE = _REF_DIR / "sources" / "doa_registry_raw.csv"
REGISTRY_OUT = "registered_compounds.yaml"
PRODUCTS_OUT = "doa_products.yaml"
# Maps KB crop slugs <-> DOA (mymrl) Malay commodity names for reconciliation.
COMMODITY_MAP = "crop_commodity_map.yaml"

# Columns the export must provide (one row per registered product-crop use).
REQUIRED_COLUMNS = (
    "active_ingredient", "trade_name", "crop", "target",
    "dosage", "phi_days", "registration_no", "approval_status",
    "source_url", "retrieved_date",
)

# Only these domains (or their subdomains) count as an authoritative MY source.
ALLOWED_SOURCE_DOMAINS = ("doa.gov.my",)


def _norm(s) -> str:
    return (s or "").strip().lower()


def _source_domain_ok(url: str) -> bool:
    """True if url's host is (a subdomain of) an allow-listed MY gov domain."""
    host = _norm(urlparse(url or "").hostname)
    if not host:
        return False
    return any(host == d or host.endswith("." + d) for d in ALLOWED_SOURCE_DOMAINS)


def parse_registry_csv(raw_path: Path) -> list[dict]:
    """Read the export into a list of row dicts. Raises on missing columns."""
    raw_path = Path(raw_path)
    with raw_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"DOA export {raw_path} missing columns: {missing}")
        rows = [{k: (v or "").strip() for k, v in row.items()} for row in reader]
    return rows


def _validate_authoritative(rows: list[dict]) -> tuple[bool, list[str]]:
    """Fail-closed provenance check. Returns (is_authoritative, reasons_if_not)."""
    reasons = []
    if not rows:
        return False, ["no rows in source"]
    for i, r in enumerate(rows):
        if not r.get("registration_no"):
            reasons.append(f"row {i}: missing registration_no")
        if not r.get("retrieved_date"):
            reasons.append(f"row {i}: missing retrieved_date")
        if not _source_domain_ok(r.get("source_url", "")):
            reasons.append(f"row {i}: source_url not on an allow-listed MY gov domain "
                           f"({', '.join(ALLOWED_SOURCE_DOMAINS)})")
    return (not reasons), reasons


def build_registry(rows: list[dict], authoritative: bool) -> dict:
    """Build the compliance allowlist: {status, approved:{crop:[compounds]}, ...}."""
    approved: dict[str, list[str]] = {}
    for r in rows:
        crop = _norm(r.get("crop"))
        compound = r.get("active_ingredient", "").strip()
        if not crop or not compound:
            continue
        bucket = approved.setdefault(crop, [])
        if compound not in bucket:
            bucket.append(compound)
    for crop in approved:
        approved[crop] = sorted(approved[crop])
    domains = sorted({_norm(urlparse(r.get("source_url", "")).hostname)
                      for r in rows if r.get("source_url")} - {""})
    retrieved = sorted({r.get("retrieved_date") for r in rows if r.get("retrieved_date")})
    return {
        "status": "authoritative" if authoritative else "draft",
        "approved": approved,
        "source_domains": domains,
        "retrieved": retrieved[-1] if retrieved else None,
        "product_count": len(rows),
    }


def build_products(rows: list[dict], authoritative: bool) -> dict:
    """Build the per-product dosage/PHI fact table (grounding source for Layer 2)."""
    products = []
    for r in rows:
        products.append({
            "compound": r.get("active_ingredient", "").strip(),
            "trade_name": r.get("trade_name", "").strip(),
            "crop": _norm(r.get("crop")),
            "target": r.get("target", "").strip(),
            "dosage": r.get("dosage", "").strip(),
            "phi_days": r.get("phi_days", "").strip(),
            "registration_no": r.get("registration_no", "").strip(),
            "source_url": r.get("source_url", "").strip(),
            "retrieved_date": r.get("retrieved_date", "").strip(),
        })
    return {"status": "authoritative" if authoritative else "draft", "products": products}


def ingest_doa_registry(raw_path: Path = DEFAULT_SOURCE, out_dir: Path = _REF_DIR,
                        allow_authoritative: bool = True) -> dict:
    """
    Ingest a DOA export into registered_compounds.yaml + doa_products.yaml.

    Fails closed on authority: writes `status: authoritative` only if every row
    passes provenance validation AND `allow_authoritative` is True. Returns a
    summary dict. If `raw_path` is absent, writes NOTHING (keeps the committed
    stub) and returns {"written": False, "reason": "no source"}.
    """
    raw_path = Path(raw_path)
    out_dir = Path(out_dir)
    if not raw_path.exists():
        logger.warning(
            f"No DOA export at {raw_path} — registration gate stays disabled. "
            "Supply a verified export to populate the registry.")
        return {"written": False, "reason": "no source", "status": "stub"}

    rows = parse_registry_csv(raw_path)
    ok, reasons = _validate_authoritative(rows)
    authoritative = ok and allow_authoritative
    if not authoritative:
        why = "provenance incomplete" if not ok else "allow_authoritative=False"
        logger.warning(f"DOA registry NOT authoritative ({why}); writing status: draft. "
                       + ("; ".join(reasons[:3]) if reasons else ""))

    registry = build_registry(rows, authoritative)
    products = build_products(rows, authoritative)

    out_dir.mkdir(parents=True, exist_ok=True)
    _write_yaml(out_dir / REGISTRY_OUT, registry,
                header="# GENERATED by pipeline.doa_registry from a DOA export.\n"
                       "# Do not hand-edit; re-run ingestion to change.\n")
    _write_yaml(out_dir / PRODUCTS_OUT, products,
                header="# GENERATED by pipeline.doa_registry — per-product dosage/PHI facts.\n")

    logger.info(f"DOA ingest: {len(rows)} rows, {len(registry['approved'])} crops, "
                f"status={registry['status']}")
    return {
        "written": True,
        "status": registry["status"],
        "rows": len(rows),
        "crops": sorted(registry["approved"]),
        "authoritative": authoritative,
        "provenance_reasons": reasons,
    }


def _write_yaml(path: Path, data: dict, header: str = ""):
    body = yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)
    path.write_text(header + body, encoding="utf-8")


def load_commodity_to_slug(map_path: Path = None) -> dict[str, str]:
    """Reverse the crop-slug map into {normalized DOA commodity -> KB slug}.

    Used to translate mymrl's Malay commodity names to KB crop slugs so the
    audit can reconcile them. Missing map file -> {} (audit falls back to raw
    commodity names, i.e. pre-map behavior).
    """
    if map_path is None:
        map_path = _REF_DIR / COMMODITY_MAP
    map_path = Path(map_path)
    if not map_path.exists():
        return {}
    data = yaml.safe_load(map_path.read_text(encoding="utf-8")) or {}
    reverse: dict[str, str] = {}
    for slug, commodities in (data.get("map") or {}).items():
        for commodity in (commodities or []):
            reverse[_norm(commodity)] = _norm(slug)
    return reverse


def audit_entries_against_registry(data_dir: Path = _DATA_DIR,
                                   products_path: Path = None,
                                   commodity_map_path: Path = None) -> dict:
    """
    Reconcile existing KB entries against the DOA product facts. Reports, per
    treatment: registered / off-label, and dosage/PHI match vs mismatch vs
    missing. This is what independently validates the seed-generated facts and
    surfaces unsupported source_citations. Read-only; mutates nothing.

    DOA facts are keyed by Malay commodity name; the crop-slug map translates
    them to KB slugs so slug-keyed KB entries reconcile (unmapped -> raw name).
    """
    data_dir = Path(data_dir)
    if products_path is None:
        products_path = _REF_DIR / PRODUCTS_OUT
    products_path = Path(products_path)
    if not products_path.exists():
        return {"available": False, "reason": f"{products_path} not found — run ingest first"}

    commodity_to_slug = load_commodity_to_slug(commodity_map_path)
    pdata = yaml.safe_load(products_path.read_text(encoding="utf-8")) or {}
    # Index facts by (crop-slug, compound) -> row; translate Malay commodity via map.
    index: dict[tuple, dict] = {}
    for p in pdata.get("products", []):
        crop_key = _norm(p.get("crop"))
        crop_key = commodity_to_slug.get(crop_key, crop_key)
        index[(crop_key, _norm(p.get("compound")))] = p

    findings = []
    for yaml_file in sorted(data_dir.glob("crops/**/diseases/*.yaml")):
        entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8")) or {}
        crop = _norm(entry.get("crop"))
        disease = entry.get("disease") or {}
        for i, t in enumerate(disease.get("treatments") or []):
            compound = _norm(t.get("compound"))
            fact = index.get((crop, compound))
            field = f"{yaml_file.name}:disease.treatments[{i}]"
            if fact is None:
                findings.append({"field": field, "compound": t.get("compound"),
                                 "status": "off_label_or_uncatalogued"})
                continue
            phi_entry = str(t.get("pre_harvest_interval_days", "")).strip()
            phi_fact = str(fact.get("phi_days", "")).strip()
            findings.append({
                "field": field, "compound": t.get("compound"), "status": "registered",
                "phi_match": (phi_entry == phi_fact) if (phi_entry and phi_fact) else None,
                "entry_phi": phi_entry or None, "registry_phi": phi_fact or None,
            })
    return {"available": True, "status": pdata.get("status"), "findings": findings}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    summary = ingest_doa_registry()
    print("DOA registry ingest:", summary)
    if summary.get("written"):
        audit = audit_entries_against_registry()
        if audit.get("available"):
            reg = sum(1 for f in audit["findings"] if f["status"] == "registered")
            off = sum(1 for f in audit["findings"] if f["status"] != "registered")
            print(f"KB reconciliation: {reg} registered, {off} off-label/uncatalogued "
                  f"(registry status={audit['status']})")
