"""
Seed generator: produce high-quality YAML entries from Claude's agricultural knowledge.
Targets top Malaysian crop diseases where MARDI source docs are thin.
Uses claude CLI (claude -p) — no API key required.
"""
import subprocess
import yaml
import re
import logging
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)

# Top Malaysian crop diseases to seed — ordered by economic importance
SEED_TARGETS = [
    # Paddy
    ("paddy",    "sheath_blight",             "Rhizoctonia solani",                   "fungi"),
    ("paddy",    "bacterial_leaf_blight",      "Xanthomonas oryzae pv. oryzae",        "bacteria"),
    ("paddy",    "brown_plant_hopper",         "Nilaparvata lugens",                   "pest"),
    ("paddy",    "rice_tungro",               "Rice tungro spherical virus",           "virus"),
    ("paddy",    "neck_blast",                "Magnaporthe oryzae",                    "fungi"),
    ("paddy",    "false_smut",               "Ustilaginoidea virens",                  "fungi"),
    # Durian
    ("durian",   "phytophthora_root_rot",      "Phytophthora palmivora",               "fungi"),
    ("durian",   "patch_canker",               "Phytophthora palmivora",               "fungi"),
    ("durian",   "gibberella_stem_rot",        "Gibberella fujikuroi",                  "fungi"),
    # Banana
    ("banana",   "fusarium_wilt",              "Fusarium oxysporum f.sp. cubense",      "fungi"),
    ("banana",   "banana_bunchy_top",          "Banana bunchy top virus",               "virus"),
    ("banana",   "sigatoka_leaf_spot",         "Mycosphaerella fijiensis",              "fungi"),
    # Chilli
    ("chilli",   "anthracnose",                "Colletotrichum capsici",                "fungi"),
    ("chilli",   "bacterial_wilt",             "Ralstonia solanacearum",               "bacteria"),
    ("chilli",   "powdery_mildew",             "Leveillula taurica",                    "fungi"),
    # Tomato
    ("tomato",   "early_blight",               "Alternaria solani",                     "fungi"),
    ("tomato",   "late_blight",                "Phytophthora infestans",               "fungi"),
    ("tomato",   "bacterial_canker",           "Clavibacter michiganensis",            "bacteria"),
    ("tomato",   "tomato_yellow_leaf_curl",    "Tomato yellow leaf curl virus",         "virus"),
    # Rubber
    ("rubber",   "powdery_mildew",             "Oidium heveae",                        "fungi"),
    ("rubber",   "south_american_leaf_blight", "Microcyclus ulei",                     "fungi"),
    ("rubber",   "pink_disease",               "Erythricium salmonicolor",              "fungi"),
    # Oil palm
    ("oil_palm", "ganoderma_basal_stem_rot",   "Ganoderma boninense",                  "fungi"),
    ("oil_palm", "upper_stem_rot",             "Ganoderma boninense",                  "fungi"),
    ("oil_palm", "frond_rot",                  "Marasmius palmivorus",                  "fungi"),
    # Cocoa
    ("cocoa",    "vascular_streak_dieback",    "Ceratobasidium theobromae",            "fungi"),
    ("cocoa",    "black_pod",                  "Phytophthora palmivora",               "fungi"),
    # Mango
    ("mango",    "anthracnose",                "Colletotrichum gloeosporioides",        "fungi"),
    ("mango",    "powdery_mildew",             "Oidium mangiferae",                    "fungi"),
    ("mango",    "bacterial_black_spot",       "Xanthomonas campestris pv. mangiferaeindicae", "bacteria"),
    # Pineapple
    ("pineapple","heart_rot",                  "Phytophthora cinnamomi",               "oomycete"),
    ("pineapple","fruitlet_core_rot",          "Penicillium funiculosum",              "fungi"),
    # Watermelon
    ("watermelon","gummy_stem_blight",         "Didymella bryoniae",                   "fungi"),
    ("watermelon","downy_mildew",              "Pseudoperonospora cubensis",           "oomycete"),
    # Papaya
    ("papaya",   "papaya_ringspot_virus",      "Papaya ringspot virus",                "virus"),
    ("papaya",   "phytophthora_fruit_rot",     "Phytophthora palmivora",               "oomycete"),
    # Sayuran (vegetables)
    ("sayuran",  "downy_mildew",              "Peronospora parasitica",                "oomycete"),
    ("sayuran",  "cucumber_mosaic_virus",     "Cucumber mosaic virus",                 "virus"),
    ("sayuran",  "damping_off",               "Pythium aphanidermatum",               "oomycete"),
]

SEED_PROMPT = """You are an agricultural data expert with deep knowledge of Malaysian crop diseases.

Generate a precise YAML entry for this specific crop disease as it presents in Malaysia.
Use MARDI, DOA Malaysia, or FAO sources where possible.

Crop: {crop}
Disease: {disease_name} (pathogen: {pathogen}, type: {path_type})
Today's date: {today}

Output ONLY raw YAML (no markdown, no explanation). Follow this exact structure:

crop: {crop}
disease:
  name: {disease_name}
  local_name: <Bahasa Malaysia name>
  pathogen:
    type: {path_type}
    species: {pathogen}
  symptoms:
    visual:
      - <symptom 1>
      - <symptom 2>
      - <symptom 3>
    growth: <yield impact / economic significance in Malaysia>
  severity_stages:
    - stage: early
      signs: <early signs>
    - stage: moderate
      signs: <moderate signs>
    - stage: severe
      signs: <severe signs>
  treatments:
    - compound: <chemical compound name>
      trade_name: <brand name available in Malaysia>
      dosage: <specific dosage per litre or per hectare>
      method: <foliar spray | soil drench | seed treatment | etc>
      frequency: <how often>
      pre_harvest_interval_days: <number or null>
      regulatory_status: MY_approved
    - compound: <second compound>
      trade_name: <brand name>
      dosage: <dosage>
      method: <method>
      frequency: <frequency>
      pre_harvest_interval_days: <number or null>
      regulatory_status: MY_approved
  cultural_controls:
    - <cultural practice 1>
    - <cultural practice 2>
  source_citations:
    - <specific MARDI or DOA publication>
    - <secondary reference>
  confidence_score: <0.75 to 0.92 depending on your certainty>
  last_updated: "{today}"

Rules:
- Use null for any field you are genuinely uncertain about
- Set confidence_score below 0.75 if you are uncertain about dosages
- regulatory_status must be exactly: MY_approved, MY_restricted, MY_banned, or unknown
- disease.name must be snake_case
- Dosages must be specific (e.g. "0.5g per litre water") not vague
- Only include treatments registered in Malaysia (Pesticide Act 1974)
- local_name must be actual Bahasa Malaysia term used by farmers"""


def _claude(prompt: str) -> str:
    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True,
        text=True,
        timeout=180
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude CLI exited {result.returncode}: {result.stderr[:300]}")
    return result.stdout.strip()


def _strip_fences(text: str) -> str:
    text = re.sub(r"^```ya?ml?\s*\n?", "", text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def generate_seed_entry(crop: str, disease_name: str, pathogen: str, path_type: str):
    prompt = SEED_PROMPT.format(
        crop=crop,
        disease_name=disease_name,
        pathogen=pathogen,
        path_type=path_type,
        today=date.today().isoformat()
    )
    try:
        raw = _claude(prompt)
        yaml_text = _strip_fences(raw)
        entry = yaml.safe_load(yaml_text)
        if entry and isinstance(entry, dict) and "crop" in entry:
            entry["_source_file"] = "seed_generator"
            return entry
        logger.warning(f"Bad output for {crop}/{disease_name}: {yaml_text[:200]}")
        return None
    except yaml.YAMLError as e:
        logger.error(f"YAML parse error for {crop}/{disease_name}: {e}")
        return None
    except RuntimeError as e:
        logger.error(f"Claude CLI error for {crop}/{disease_name}: {e}")
        return None


def run_seed_generation(data_dir: Path = Path("data"), targets: list = None) -> list[Path]:
    if targets is None:
        targets = SEED_TARGETS

    saved = []
    for crop, disease_name, pathogen, path_type in targets:
        dest = data_dir / "crops" / crop / "diseases" / f"{disease_name}.yaml"
        if dest.exists():
            logger.info(f"Already exists, skipping: {dest.name}")
            saved.append(dest)
            continue

        logger.info(f"Generating: {crop}/{disease_name}")
        entry = generate_seed_entry(crop, disease_name, pathogen, path_type)
        if entry:
            from .extractor import save_entry
            path = save_entry(entry, data_dir)
            saved.append(path)
            logger.info(f"  Saved: {path}")
        else:
            logger.warning(f"  Failed: {crop}/{disease_name}")

    return saved


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    data_dir = Path(__file__).parent.parent / "data"
    saved = run_seed_generation(data_dir)
    print(f"\nGenerated {len(saved)} seed entries")
