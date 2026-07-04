"""
MARDI publication scraper.
Crawls mardi.gov.my, downloads research bulletins and advisory PDFs,
and extracts raw text for the extractor stage.
"""
import requests
from bs4 import BeautifulSoup
import time
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

MARDI_BASE_URL = "https://www.mardi.gov.my"

# Verified publication pages (confirmed 200 OK)
MARDI_PUBLICATION_PAGES = [
    MARDI_BASE_URL + "/ms/penerbitan/penerbitan-berkala/buletin-pemindahan-teknologi-mardi-bptm.html",
    MARDI_BASE_URL + "/ms/penerbitan/penerbitan-berkala/makalah-sesekala.html",
    MARDI_BASE_URL + "/ms/penerbitan/penerbitan-berkala/laporan-tahunan-mardi.html",
    MARDI_BASE_URL + "/ms/penyelidikan/sains-teknologi-makanan.html",
]

OUTPUT_DIR = Path("data/raw/pdfs")


def scrape_mardi_publications(limit: int = 50) -> list[str]:
    """
    Download MARDI research bulletins from all known publication pages.
    Returns list of saved PDF paths.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update({
        "User-Agent": "AgriSchema-MY Research Bot (open-source agriculture knowledge base, github.com/agri-schema-my)"
    })

    # Collect all PDF links across all publication pages
    pdf_links = []
    for page_url in MARDI_PUBLICATION_PAGES:
        try:
            response = session.get(page_url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            for link in soup.find_all("a", href=True):
                href = link["href"]
                if ".pdf" in href.lower():
                    if not href.startswith("http"):
                        href = MARDI_BASE_URL + href
                    title = link.get_text(strip=True) or f"doc_{len(pdf_links)}"
                    pdf_links.append((title, href))
            logger.info(f"Page {page_url}: found {len(pdf_links)} PDFs so far")
        except Exception as e:
            logger.warning(f"Failed to fetch {page_url}: {e}")

    logger.info(f"Total PDFs found across all pages: {len(pdf_links)}")

    downloaded = []
    for i, (title, url) in enumerate(pdf_links[:limit]):
        safe_title = title[:60].replace("/", "_").replace("\\", "_").replace(" ", "_")
        filename = OUTPUT_DIR / f"mardi_{i:04d}_{safe_title}.pdf"

        if filename.exists():
            logger.info(f"Cached: {filename.name}")
            downloaded.append(str(filename))
            continue

        try:
            r = session.get(url, timeout=60, stream=True)
            r.raise_for_status()
            with open(filename, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            downloaded.append(str(filename))
            logger.info(f"Downloaded: {filename.name}")
            time.sleep(1)  # polite — 1 req/sec
        except Exception as e:
            logger.warning(f"Failed {url}: {e}")

    return downloaded


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract raw text from PDF using pdfplumber."""
    import pdfplumber
    pages = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
    except Exception as e:
        logger.warning(f"pdfplumber failed on {pdf_path}: {e}")
    return "\n\n".join(pages)


def fetch_fao_agrovoc(crop_term: str) -> dict:
    """
    Fetch FAO AGROVOC Linked Open Data for a crop term.
    Returns {lang: label} dict. Free, no auth required.
    """
    endpoint = "https://agrovoc.fao.org/sparql"
    query = f"""
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?label ?lang WHERE {{
        ?c skos:prefLabel "{crop_term}"@en .
        ?c skos:prefLabel ?label .
        BIND(lang(?label) AS ?lang)
        FILTER(?lang IN ("en","ms","id"))
    }} LIMIT 10
    """
    try:
        r = requests.get(
            endpoint,
            params={"query": query, "format": "json"},
            timeout=10
        )
        r.raise_for_status()
        bindings = r.json().get("results", {}).get("bindings", [])
        return {b["lang"]["value"]: b["label"]["value"] for b in bindings}
    except Exception as e:
        logger.warning(f"AGROVOC lookup failed for '{crop_term}': {e}")
        return {}
