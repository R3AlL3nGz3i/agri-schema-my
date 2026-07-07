"""
Passage corpus builder for Layer 2 grounded review (paddy prototype).

Turns the raw MARDI PDFs downloaded by pipeline.scraper into a JSONL corpus of
overlapping word-windows, each carrying its source PDF + page. A relevance
checkpoint reports how much of the corpus actually mentions paddy/rice diseases
-- if that is ~0, grounding against this source is not feasible and we stop
rather than build a reviewer over irrelevant text.
"""
import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent

PDF_DIR = _PROJECT_ROOT / "data" / "raw" / "pdfs"
PASSAGES_JSONL = _PROJECT_ROOT / "data" / "raw" / "passages" / "mardi_passages.jsonl"

WINDOW_WORDS = 500
OVERLAP_WORDS = 60

# Terms that mark a passage as paddy/rice-relevant. Includes Malay (padi, karah,
# hawar, seludang) and English disease vocabulary plus the 5 prototype diseases.
PADDY_TERMS = [
    "padi", "rice", "blast", "karah", "hawar", "tungro", "seludang",
    "rice blast", "bacterial leaf blight", "false smut", "rice tungro",
    "sheath blight",
]


def _extract_pages(pdf_path: str) -> list[str]:
    """Return one text string per real PDF page (true page boundaries).

    Deliberately NOT reconstructed from scraper.extract_text_from_pdf's joined
    output: that joins pages with "\\n\\n" and pdfplumber also emits "\\n\\n"
    between paragraphs *within* a page, so splitting on it drifts page numbers.
    Since the whole value of grounding is an accurate "source p.N" citation, we
    read pages directly and keep the real 1-based index.
    """
    import pdfplumber
    pages = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                pages.append(page.extract_text() or "")
    except Exception as e:
        logger.warning(f"pdfplumber failed on {pdf_path}: {e}")
    return pages


def _window_page(text: str, window: int = WINDOW_WORDS, overlap: int = OVERLAP_WORDS) -> list[str]:
    """Split one page of text into ~`window`-word chunks with `overlap` carry-over."""
    words = text.split()
    if not words:
        return []
    if len(words) <= window:
        return [" ".join(words)]
    step = window - overlap
    chunks = []
    for start in range(0, len(words), step):
        chunk = words[start:start + window]
        if chunk:
            chunks.append(" ".join(chunk))
        if start + window >= len(words):
            break
    return chunks


def build_passages(pdf_dir: Path = PDF_DIR, out_jsonl: Path = PASSAGES_JSONL) -> int:
    """
    Extract + chunk every PDF in `pdf_dir` into `out_jsonl`.
    Each row: {id, text, source_pdf, page}. Returns number of passages written.
    """
    pdf_dir = Path(pdf_dir)
    out_jsonl = Path(out_jsonl)
    out_jsonl.parent.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(pdf_dir.glob("*.pdf"))
    if not pdfs:
        logger.warning(f"No PDFs found in {pdf_dir} -- run the scraper first.")

    written = 0
    with out_jsonl.open("w", encoding="utf-8") as f:
        for pdf_path in pdfs:
            pages = _extract_pages(str(pdf_path))  # true per-page boundaries
            for page_no, page_text in enumerate(pages, start=1):
                if not page_text.strip():
                    continue
                for chunk_idx, chunk in enumerate(_window_page(page_text)):
                    row = {
                        "id": f"{pdf_path.stem}__p{page_no}__c{chunk_idx}",
                        "text": chunk,
                        "source_pdf": pdf_path.name,
                        "page": page_no,
                    }
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
                    written += 1
    logger.info(f"Wrote {written} passages from {len(pdfs)} PDFs to {out_jsonl}")
    return written


def report_relevance(jsonl: Path = PASSAGES_JSONL) -> dict:
    """
    CHECKPOINT: report how many passages mention paddy/rice terms.
    Prints a summary and returns {total, relevant, per_term}. If `relevant` is
    ~0 the MARDI corpus does not cover paddy diseases and grounding is infeasible.
    """
    jsonl = Path(jsonl)
    if not jsonl.exists():
        raise RuntimeError(f"Passage corpus not found at {jsonl}. Run build_passages() first.")

    total = 0
    relevant = 0
    per_term = {t: 0 for t in PADDY_TERMS}
    with jsonl.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            total += 1
            text_lc = row["text"].lower()
            hit = False
            for t in PADDY_TERMS:
                if t in text_lc:
                    per_term[t] += 1
                    hit = True
            if hit:
                relevant += 1

    print("=== Passage relevance checkpoint ===")
    print(f"Total passages:          {total}")
    print(f"Paddy/rice-relevant:     {relevant}"
          + (f"  ({100 * relevant / total:.1f}%)" if total else ""))
    print("Per-term hit counts:")
    for t in sorted(per_term, key=lambda k: -per_term[k]):
        if per_term[t]:
            print(f"  {t:24s} {per_term[t]}")
    if relevant == 0:
        print("\nVERDICT: MARDI corpus does not cover paddy diseases -- "
              "grounding not feasible from this source.")

    return {"total": total, "relevant": relevant, "per_term": per_term}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    n = build_passages()
    print(f"Built {n} passages.")
    report_relevance()
