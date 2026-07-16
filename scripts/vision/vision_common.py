"""
Shared helpers for the agri-schema-my image-classification DATA PREPARATION
scripts (build_manifest / dedupe_qa / split_dataset).

DATA-PREP ONLY. This package does not train, preprocess, or serve any model.
It produces a clean, labelled, source-tracked, split image dataset plus manifests
that hand off to a separate ML training phase the user owns.

The single source of truth for the v1 label taxonomy lives here in TAXONOMY.
Every non-`healthy` class name is an exact `disease.name` slug from
`data/crops/<crop>/diseases/<slug>.yaml`, so a future /diagnose endpoint can emit
the slug and reuse the existing GET /crops/{crop}/diseases/{slug} route.

On-disk dataset layout (images are gitignored):

    data/vision/images/<crop>/<class>/<source_dataset>/*.jpg

The <source_dataset> directory level is REQUIRED: it lets build_manifest fill the
`source_dataset`/`source_url`/`license` columns from data/vision/sources.yaml and
lets split_dataset keep every source group inside a single split (leakage guard).
"""
from __future__ import annotations

from pathlib import Path
from dataclasses import dataclass

import yaml

_MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = _MODULE_DIR.parent.parent
KB_DIR = PROJECT_ROOT / "data" / "crops"
VISION_DIR = PROJECT_ROOT / "data" / "vision"
IMAGES_DIR = VISION_DIR / "images"
MANIFEST_PATH = VISION_DIR / "manifest.csv"
SOURCES_PATH = VISION_DIR / "sources.yaml"
CLASS_INDEX_DIR = VISION_DIR / "class_index"

HEALTHY_CLASS = "healthy"

# Manifest column order — treated as a contract by all three scripts and the ML side.
MANIFEST_COLUMNS = [
    "path",             # posix path relative to PROJECT_ROOT
    "crop",
    "class",            # KB disease.name slug, or "healthy"
    "kb_disease_slug",  # == class for a disease, empty for "healthy"
    "pathogen_type",    # from KB disease.pathogen.type; empty for "healthy"
    "source_dataset",   # <source_dataset> dir name; key into sources.yaml
    "source_url",
    "license",
    "organ",            # leaf / fruit / panicle / stem / whole_plant
    "split",            # train / val / test (filled by split_dataset.py)
    "phash",            # perceptual hash (filled by build_manifest.py)
]

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}


@dataclass(frozen=True)
class ClassSpec:
    name: str          # class label (KB slug or "healthy")
    organ: str         # default organ for images of this class
    note: str = ""     # honesty caveat carried into DATA_CARD / manifest review


# v1 crop-conditioned taxonomy. Order here == class_index ordering (healthy last).
# organ = the plant part a field photo of this class should show. false_smut and
# pink_disease are deliberately NON-leaf (panicle / stem) — collect organ-appropriate
# images, not leaves.
TAXONOMY: dict[str, list[ClassSpec]] = {
    "paddy": [
        ClassSpec("rice_blast", "leaf"),
        ClassSpec("bacterial_leaf_blight", "leaf"),
        ClassSpec("sheath_blight", "leaf"),
        ClassSpec("rice_tungro", "leaf"),
        ClassSpec("false_smut", "panicle",
                  "NON-LEAF: grain/panicle disease. Collect panicle images, not leaves."),
        ClassSpec(HEALTHY_CLASS, "leaf"),
    ],
    "banana": [
        ClassSpec("sigatoka_leaf_spot", "leaf"),
        ClassSpec("fusarium_wilt", "whole_plant",
                  "Public images are Race 1, NOT TR4 — label as Race 1, do not silently call it TR4."),
        ClassSpec("banana_bunchy_top", "whole_plant"),
        ClassSpec(HEALTHY_CLASS, "leaf"),
    ],
    "chilli": [
        ClassSpec("anthracnose", "fruit"),
        ClassSpec("powdery_mildew", "leaf"),
        ClassSpec("bacterial_wilt", "whole_plant"),
        ClassSpec(HEALTHY_CLASS, "leaf"),
    ],
    "tomato": [
        ClassSpec("early_blight", "leaf"),
        ClassSpec("late_blight", "leaf"),
        ClassSpec("tomato_yellow_leaf_curl", "leaf"),
        ClassSpec("bacterial_canker", "leaf"),
        ClassSpec(HEALTHY_CLASS, "leaf"),
    ],
    "rubber": [
        ClassSpec("powdery_mildew", "leaf"),
        ClassSpec("pink_disease", "stem",
                  "NON-LEAF: bark/stem disease. Collect stem/bark images, not leaves."),
        ClassSpec(HEALTHY_CLASS, "leaf"),
    ],
    "cocoa": [
        ClassSpec("vascular_streak_dieback", "leaf"),
        ClassSpec(HEALTHY_CLASS, "leaf"),
    ],
}


def load_kb_slugs() -> dict[str, dict[str, dict]]:
    """Scan data/crops/<crop>/diseases/*.yaml -> {crop: {slug: {pathogen_type, species}}}."""
    kb: dict[str, dict[str, dict]] = {}
    for yaml_path in sorted(KB_DIR.glob("*/diseases/*.yaml")):
        with yaml_path.open() as f:
            doc = yaml.safe_load(f)
        crop = doc.get("crop")
        disease = doc.get("disease") or {}
        slug = disease.get("name")
        if not crop or not slug:
            raise ValueError(f"{yaml_path} missing crop or disease.name")
        pathogen = disease.get("pathogen") or {}
        kb.setdefault(crop, {})[slug] = {
            "pathogen_type": pathogen.get("type", ""),
            "species": pathogen.get("species", ""),
        }
    return kb


def validate_taxonomy(kb: dict[str, dict[str, dict]] | None = None) -> None:
    """Fail loudly if any non-healthy class is not a real KB slug for its crop."""
    if kb is None:
        kb = load_kb_slugs()
    errors: list[str] = []
    for crop, specs in TAXONOMY.items():
        if crop not in kb:
            errors.append(f"crop '{crop}' has no KB directory under data/crops/")
            continue
        for spec in specs:
            if spec.name == HEALTHY_CLASS:
                continue
            if spec.name not in kb[crop]:
                available = ", ".join(sorted(kb[crop])) or "(none)"
                errors.append(
                    f"class '{crop}/{spec.name}' is not a KB disease.name slug. "
                    f"Available slugs for {crop}: {available}"
                )
    if errors:
        raise SystemExit(
            "Taxonomy validation FAILED — every class must map to an existing KB slug:\n  - "
            + "\n  - ".join(errors)
        )


def class_spec(crop: str, cls: str) -> ClassSpec | None:
    for spec in TAXONOMY.get(crop, []):
        if spec.name == cls:
            return spec
    return None


def load_source_registry() -> dict[str, dict]:
    """Read data/vision/sources.yaml -> {source_key: {name,url,license,type,organ?,flags?}}."""
    if not SOURCES_PATH.exists():
        return {}
    with SOURCES_PATH.open() as f:
        doc = yaml.safe_load(f) or {}
    return doc.get("sources", {}) or {}


def iter_image_files(images_dir: Path = IMAGES_DIR):
    """Yield every image file under images/<crop>/<class>/<source>/ (any depth >= that)."""
    if not images_dir.exists():
        return
    for path in sorted(images_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            yield path


def parse_image_path(path: Path, images_dir: Path = IMAGES_DIR) -> tuple[str, str, str]:
    """images/<crop>/<class>/<source_dataset>/<file> -> (crop, class, source_dataset)."""
    rel = path.relative_to(images_dir)
    parts = rel.parts
    if len(parts) < 4:
        raise ValueError(
            f"{path} is not under images/<crop>/<class>/<source_dataset>/<file>. "
            f"Every image needs a source_dataset subfolder (leakage-split + attribution)."
        )
    crop, cls, source = parts[0], parts[1], parts[2]
    return crop, cls, source


def rel_to_root(path: Path) -> str:
    return path.resolve().relative_to(PROJECT_ROOT).as_posix()


def _require_pillow():
    try:
        from PIL import Image  # noqa: F401
    except ImportError as exc:  # pragma: no cover - environment guard
        raise SystemExit(
            "Pillow is required for image QA/hashing. Install with:\n"
            "  pip install Pillow imagehash\n"
            "(both are listed in requirements.txt)"
        ) from exc


def _require_imagehash():
    try:
        import imagehash  # noqa: F401
    except ImportError as exc:  # pragma: no cover - environment guard
        raise SystemExit(
            "imagehash is required for perceptual-hash dedupe. Install with:\n"
            "  pip install imagehash\n"
            "(listed in requirements.txt)"
        ) from exc


def open_image(path: Path):
    """Open + verify an image; return a loaded PIL RGB image, or None if unreadable."""
    _require_pillow()
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(path) as im:
            im.load()
            return im.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        return None


def compute_phash(path: Path) -> str:
    """Perceptual hash (pHash) hex string, or '' if the image cannot be read."""
    _require_imagehash()
    import imagehash

    im = open_image(path)
    if im is None:
        return ""
    return str(imagehash.phash(im))


def hamming(a: str, b: str) -> int:
    """Hamming distance between two hex pHash strings (assumes equal bit length)."""
    if not a or not b:
        return 64
    ia, ib = int(a, 16), int(b, 16)
    return bin(ia ^ ib).count("1")
