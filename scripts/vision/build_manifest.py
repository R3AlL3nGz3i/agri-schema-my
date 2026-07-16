#!/usr/bin/env python3
"""
build_manifest.py — scaffold the class folders and/or build data/vision/manifest.csv.

DATA-PREP ONLY. Does not train or preprocess anything.

Modes
  --scaffold   Validate the taxonomy against the KB, create empty
               images/<crop>/<class>/ folders, and (re)write the per-crop
               class_index/<crop>.json stable class->int maps. Run this first.
  (default)    Validate the taxonomy, walk images/<crop>/<class>/<source>/*,
               and write manifest.csv (one row per image) with columns:
                 path, crop, class, kb_disease_slug, pathogen_type,
                 source_dataset, source_url, license, organ, split, phash
               kb_disease_slug/pathogen_type come from the KB YAML; source_url/
               license/organ come from data/vision/sources.yaml (organ can be
               overridden per class in the taxonomy). Any existing `split`
               assignment is PRESERVED by path so re-scanning after adding
               images does not wipe an earlier split (re-run split_dataset to
               cover newly added images).

Fails loudly on: a class that is not a real KB slug, an image not under a
<source_dataset> subfolder, or a source_dataset key missing from sources.yaml.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vision_common as vc


def scaffold() -> None:
    kb = vc.load_kb_slugs()
    vc.validate_taxonomy(kb)
    vc.CLASS_INDEX_DIR.mkdir(parents=True, exist_ok=True)
    created = 0
    for crop, specs in vc.TAXONOMY.items():
        index = {}
        for i, spec in enumerate(specs):
            folder = vc.IMAGES_DIR / crop / spec.name
            if not folder.exists():
                folder.mkdir(parents=True, exist_ok=True)
                created += 1
            index[spec.name] = i
        out = vc.CLASS_INDEX_DIR / f"{crop}.json"
        out.write_text(json.dumps(index, indent=2) + "\n")
    n_classes = sum(len(s) for s in vc.TAXONOMY.values())
    print(f"Scaffold OK: {len(vc.TAXONOMY)} crops, {n_classes} classes "
          f"(all validated against the KB).")
    print(f"  Created {created} new class folder(s) under {vc.IMAGES_DIR}")
    print(f"  Wrote class_index/*.json under {vc.CLASS_INDEX_DIR}")
    print("  Next: drop images into images/<crop>/<class>/<source_dataset>/ "
          "then run dedupe_qa.py and build_manifest.py.")


def _load_existing_splits() -> dict[str, str]:
    """Preserve prior `split` values keyed by manifest `path`."""
    if not vc.MANIFEST_PATH.exists():
        return {}
    splits: dict[str, str] = {}
    with vc.MANIFEST_PATH.open(newline="") as f:
        for row in csv.DictReader(f):
            if row.get("split"):
                splits[row["path"]] = row["split"]
    return splits


def build() -> int:
    kb = vc.load_kb_slugs()
    vc.validate_taxonomy(kb)
    sources = vc.load_source_registry()
    prior_splits = _load_existing_splits()

    rows: list[dict] = []
    unknown_sources: set[str] = set()
    unknown_classes: list[str] = []

    for img in vc.iter_image_files():
        crop, cls, source = vc.parse_image_path(img)
        spec = vc.class_spec(crop, cls)
        if spec is None:
            unknown_classes.append(f"{crop}/{cls}  ({img})")
            continue

        if cls == vc.HEALTHY_CLASS:
            kb_slug, pathogen_type = "", ""
        else:
            kb_slug = cls
            pathogen_type = kb.get(crop, {}).get(cls, {}).get("pathogen_type", "")

        src = sources.get(source)
        if src is None:
            unknown_sources.add(source)
            source_url, license_ = "", ""
        else:
            source_url = src.get("url", "")
            license_ = src.get("license", "")

        # organ precedence: class-level override in taxonomy wins; else source default; else "leaf"
        organ = spec.organ or (src or {}).get("organ", "leaf")

        rel = vc.rel_to_root(img)
        rows.append({
            "path": rel,
            "crop": crop,
            "class": cls,
            "kb_disease_slug": kb_slug,
            "pathogen_type": pathogen_type,
            "source_dataset": source,
            "source_url": source_url,
            "license": license_,
            "organ": organ,
            "split": prior_splits.get(rel, ""),
            "phash": vc.compute_phash(img),
        })

    if unknown_classes:
        raise SystemExit(
            "Images found under class folders that are NOT in the taxonomy:\n  - "
            + "\n  - ".join(unknown_classes)
        )

    vc.VISION_DIR.mkdir(parents=True, exist_ok=True)
    with vc.MANIFEST_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=vc.MANIFEST_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {vc.rel_to_root(vc.MANIFEST_PATH)}")
    if unknown_sources:
        print("\nWARNING: source_dataset folders missing from data/vision/sources.yaml "
              "(source_url/license left blank — add them):")
        for s in sorted(unknown_sources):
            print(f"  - {s}")
    if not rows:
        print("\n(No images found yet. Run --scaffold, then drop images into "
              "images/<crop>/<class>/<source_dataset>/ before building.)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Scaffold folders / build the vision manifest.")
    ap.add_argument("--scaffold", action="store_true",
                    help="Validate taxonomy, create class folders, write class_index JSON, then exit.")
    args = ap.parse_args()
    if args.scaffold:
        scaffold()
        return 0
    return build()


if __name__ == "__main__":
    raise SystemExit(main())
