"""
AgriSchema-MY — main pipeline runner.

Usage:
  python run_pipeline.py --all          # full pipeline
  python run_pipeline.py --scrape       # download MARDI PDFs
  python run_pipeline.py --extract      # Claude API extraction
  python run_pipeline.py --validate     # schema validation
  python run_pipeline.py --review       # professor agent review
  python run_pipeline.py --embed        # ingest into ChromaDB
"""
import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("pipeline.log", encoding="utf-8")
    ]
)

logger = logging.getLogger("agri_pipeline")


def phase_scrape():
    from pipeline.scraper import scrape_mardi_publications, extract_text_from_pdf
    logger.info("=== SCRAPE: downloading MARDI publications ===")

    pdfs = scrape_mardi_publications(limit=50)
    logger.info(f"Downloaded {len(pdfs)} PDFs")

    text_dir = Path("data/raw/text")
    text_dir.mkdir(parents=True, exist_ok=True)

    extracted = 0
    for pdf_path in pdfs:
        text_path = text_dir / (Path(pdf_path).stem + ".txt")
        if text_path.exists():
            logger.info(f"Cached text: {text_path.name}")
            continue
        text = extract_text_from_pdf(pdf_path)
        if text.strip():
            text_path.write_text(text, encoding="utf-8")
            extracted += 1
            logger.info(f"Extracted {len(text)} chars from {Path(pdf_path).name}")

    logger.info(f"Text extraction done: {extracted} new files")
    return pdfs


def phase_seed():
    from pipeline.seed_generator import run_seed_generation
    logger.info("=== SEED: generating entries from Claude knowledge ===")
    data_dir = Path("data")
    saved = run_seed_generation(data_dir)
    logger.info(f"Seed done: {len(saved)} entries")
    return saved


def phase_extract():
    from pipeline.extractor import extract_diseases_from_text, save_entry
    logger.info("=== EXTRACT: Claude CLI extraction from PDFs ===")

    text_dir = Path("data/raw/text")
    data_dir = Path("data")
    total = 0

    for text_file in sorted(text_dir.glob("*.txt")):
        raw = text_file.read_text(encoding="utf-8")
        if len(raw.strip()) < 200:
            continue
        logger.info(f"Extracting: {text_file.name}")
        entries = extract_diseases_from_text(raw, text_file.name)
        for entry in entries:
            save_entry(entry, data_dir)
            total += 1

    logger.info(f"Extraction done: {total} entries saved")
    return total


def phase_validate():
    from pipeline.validator import validate_all
    logger.info("=== VALIDATE: schema check ===")

    results = validate_all()
    logger.info(f"Total: {results['total']}  Passed: {len(results['passed'])}  Failed: {len(results['failed'])}")

    for filepath, errors in results["failed"].items():
        logger.warning(f"FAIL: {filepath}")
        for err in errors:
            logger.warning(f"  - {err}")

    return results


def phase_compliance():
    from pipeline.compliance import check_all, print_report
    logger.info("=== COMPLIANCE: Layer 1 deterministic gate ===")

    summary = check_all()
    print_report(summary)
    logger.info(
        f"Compliance -> PASS: {len(summary['PASS'])}  "
        f"FLAG: {len(summary['FLAG'])}  REJECT: {len(summary['REJECT'])}"
    )
    return summary


def phase_review():
    from pipeline.professor_agent import review_all_entries, print_report
    logger.info("=== REVIEW: professor agent ===")

    summary = review_all_entries()
    print_report(summary)
    return summary


def phase_embed():
    from pipeline.embedder import ingest_all
    logger.info("=== EMBED: ChromaDB ingestion ===")

    result = ingest_all()
    logger.info(f"Ingested: {result['ingested']}  Skipped: {result['skipped']}")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AgriSchema-MY pipeline")
    parser.add_argument("--scrape",   action="store_true", help="Download MARDI PDFs + extract text")
    parser.add_argument("--seed",     action="store_true", help="Generate seed entries from Claude knowledge")
    parser.add_argument("--extract",  action="store_true", help="Claude CLI extraction from raw PDF text")
    parser.add_argument("--validate",   action="store_true", help="Schema validation")
    parser.add_argument("--compliance", action="store_true", help="Layer 1 deterministic compliance gate")
    parser.add_argument("--review",     action="store_true", help="Professor agent review")
    parser.add_argument("--embed",      action="store_true", help="Ingest into ChromaDB")
    parser.add_argument("--all",        action="store_true", help="Run full pipeline (seed + validate + compliance + review + embed)")
    args = parser.parse_args()

    ran_any = False

    if args.scrape:
        phase_scrape()
        ran_any = True

    if args.all or args.seed:
        phase_seed()
        ran_any = True

    if args.extract:
        phase_extract()
        ran_any = True

    if args.all or args.validate:
        phase_validate()
        ran_any = True

    if args.all or args.compliance:
        phase_compliance()
        ran_any = True

    if args.all or args.review:
        phase_review()
        ran_any = True

    if args.all or args.embed:
        phase_embed()
        ran_any = True

    if not ran_any:
        parser.print_help()
