"""
Extractor: raw PDF text -> structured YAML crop disease entries.
Uses claude CLI (claude -p) — no API key required.
"""
import subprocess
import yaml
import re
from pathlib import Path
from datetime import date
import logging

logger = logging.getLogger(__name__)

MAX_CHARS_PER_CHUNK = 12000  # conservative — claude CLI has prompt limits


EXTRACTION_PROMPT = """You are an agricultural data structuring expert for Malaysian crops.
Extract ALL crop disease entries from the source text.

Output one YAML document per disease found, separated by ---.
Output ONLY raw YAML — no markdown fences, no explanation, no preamble.
If the text contains no crop disease information, output exactly: null

Rules:
- Use null for any field not found in the source text.
- Set confidence_score below 0.70 if uncertain about any value.
- Do NOT invent dosages or compounds not mentioned in the text.
- regulatory_status must be exactly one of: MY_approved, MY_restricted, MY_banned, unknown
- disease.name must be snake_case (e.g. rice_blast, powdery_mildew)

Required YAML structure per entry:

crop: paddy
disease:
  name: rice_blast
  local_name: penyakit blas padi
  pathogen:
    type: fungi
    species: Magnaporthe oryzae
  symptoms:
    visual:
      - diamond-shaped lesions with grey centre
    growth: yield loss 20-80 percent in severe cases
  severity_stages:
    - stage: early
      signs: small brown specks less than 2mm
  treatments:
    - compound: Tricyclazole
      trade_name: Beam 75WP
      dosage: 0.5g per litre water
      method: foliar spray
      frequency: twice weekly
      pre_harvest_interval_days: 14
      regulatory_status: MY_approved
  source_citations:
    - "MARDI Bulletin 2022"
  confidence_score: 0.88
  last_updated: "{today}"

---SOURCE TEXT---
{text}"""


def _claude(prompt: str) -> str:
    """Invoke claude CLI non-interactively. Returns stdout."""
    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True,
        text=True,
        timeout=120
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude CLI exited {result.returncode}: {result.stderr[:300]}")
    return result.stdout.strip()


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if claude wraps output in them."""
    text = re.sub(r"^```ya?ml?\s*\n?", "", text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def extract_diseases_from_text(raw_text: str, source_name: str) -> list[dict]:
    """
    Send raw text through claude CLI and parse YAML disease entries.
    Chunks large texts to stay within CLI prompt limits.
    """
    chunks = [
        raw_text[i:i + MAX_CHARS_PER_CHUNK]
        for i in range(0, len(raw_text), MAX_CHARS_PER_CHUNK)
    ]

    all_entries = []

    for chunk_idx, chunk in enumerate(chunks):
        if len(chunk.strip()) < 150:
            continue

        prompt = EXTRACTION_PROMPT.format(
            text=chunk,
            today=date.today().isoformat()
        )

        try:
            raw_output = _claude(prompt)
            yaml_text = _strip_fences(raw_output)

            if yaml_text.strip().lower() in ("null", "~", ""):
                logger.info(f"[{source_name}] chunk {chunk_idx}: no diseases found")
                continue

            docs = list(yaml.safe_load_all(yaml_text))
            entries = [d for d in docs if d and isinstance(d, dict) and "crop" in d]

            for entry in entries:
                entry["_source_file"] = source_name
                entry["_chunk_index"] = chunk_idx

            all_entries.extend(entries)
            logger.info(f"[{source_name}] chunk {chunk_idx}/{len(chunks)-1}: {len(entries)} entries extracted")

        except yaml.YAMLError as e:
            logger.warning(f"YAML parse error [{source_name}] chunk {chunk_idx}: {e}")
        except RuntimeError as e:
            logger.error(f"claude CLI error [{source_name}] chunk {chunk_idx}: {e}")

    return all_entries


def save_entry(entry: dict, data_dir: Path = Path("data")) -> Path:
    """
    Save entry to data/crops/{crop}/diseases/{disease}.yaml.
    Skips if existing entry has equal or higher confidence.
    """
    crop = entry.get("crop", "unknown").lower().replace(" ", "_")
    disease = entry.get("disease", {})
    disease_name = disease.get("name", "unknown").lower().replace(" ", "_").replace("/", "_")

    folder = data_dir / "crops" / crop / "diseases"
    folder.mkdir(parents=True, exist_ok=True)
    filepath = folder / f"{disease_name}.yaml"

    new_conf = float(disease.get("confidence_score") or 0)

    if filepath.exists():
        existing = yaml.safe_load(filepath.read_text(encoding="utf-8"))
        existing_conf = float(existing.get("disease", {}).get("confidence_score") or 0)
        if existing_conf >= new_conf:
            logger.info(f"Skipping {filepath.name} — existing confidence {existing_conf} >= {new_conf}")
            return filepath

    with open(filepath, "w", encoding="utf-8") as f:
        yaml.dump(entry, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    logger.info(f"Saved: {filepath}")
    return filepath
