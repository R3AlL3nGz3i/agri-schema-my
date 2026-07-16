#!/usr/bin/env python3
"""
train_labels.py — emit the PRESENT-ONLY label map per crop for the ML side.

DATA-PREP HANDOFF HELPER (does not train anything). The committed
class_index/<crop>.json files list the FULL v1 taxonomy, including classes that
currently have ZERO images (e.g. paddy/false_smut, tomato/bacterial_canker) and
whole crops with no data at all (rubber, cocoa). Wiring those straight into a
model gives dead output neurons with no training data.

This script reads data/vision/manifest.csv and, for every crop that is actually
trainable, writes a contiguous label map over ONLY the classes present in the
manifest — preserving the taxonomy order (healthy last). It also reports the
per-split image counts so class imbalance is visible up front.

Outputs (per trainable crop) under data/vision/label_maps/<crop>.json:

    {
      "crop": "paddy",
      "classes": {"rice_blast": 0, ..., "healthy": 4},   # present-only, 0..N-1
      "num_classes": 5,
      "counts": {"rice_blast": {"train":.., "val":.., "test":..}, ...},
      "excluded_taxonomy_classes": ["false_smut"]        # in taxonomy, no images
    }

A crop is "trainable" if it has >= 2 present classes (at least one disease +
healthy). Crops below that (rubber, cocoa in v1) are reported and skipped.

Usage:
    python scripts/vision/train_labels.py            # write files + print summary
    python scripts/vision/train_labels.py --print    # print only, write nothing
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vision_common as vc

SPLITS = ("train", "val", "test")
LABEL_MAPS_DIR = vc.VISION_DIR / "label_maps"
MIN_TRAINABLE_CLASSES = 2  # need at least one disease + healthy


def present_label_maps() -> dict[str, dict]:
    """Read the manifest and build a present-only, taxonomy-ordered map per crop.

    Returns {crop: {classes, num_classes, counts, excluded_taxonomy_classes}} for
    trainable crops only. Importable by the ML side instead of re-deriving this.
    """
    if not vc.MANIFEST_PATH.exists():
        raise SystemExit(f"{vc.MANIFEST_PATH} not found. Run build_manifest.py first.")
    with vc.MANIFEST_PATH.open(newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise SystemExit("manifest.csv has no image rows yet.")

    # counts[crop][class][split] = n
    counts: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {s: 0 for s in SPLITS})
    )
    for r in rows:
        split = r["split"] if r["split"] in SPLITS else "train"
        counts[r["crop"]][r["class"]][split] += 1

    result: dict[str, dict] = {}
    for crop, present in counts.items():
        # order present classes by their position in the taxonomy (healthy stays last)
        taxonomy_order = [spec.name for spec in vc.TAXONOMY.get(crop, [])]
        ordered_present = [c for c in taxonomy_order if c in present]
        # any manifest class not in taxonomy (shouldn't happen) appended, sorted
        extra = sorted(c for c in present if c not in taxonomy_order)
        ordered_present += extra

        if len(ordered_present) < MIN_TRAINABLE_CLASSES:
            continue  # not trainable (e.g. only a healthy class) — skip, reported by caller

        excluded = [c for c in taxonomy_order if c not in present]
        result[crop] = {
            "crop": crop,
            "classes": {c: i for i, c in enumerate(ordered_present)},
            "num_classes": len(ordered_present),
            "counts": {c: dict(present[c]) for c in ordered_present},
            "excluded_taxonomy_classes": excluded,
        }
    return result


def _all_crops_status(maps: dict[str, dict]) -> list[str]:
    """One status line per taxonomy crop (trainable / skipped + why)."""
    lines: list[str] = []
    # recompute presence for skipped crops too
    with vc.MANIFEST_PATH.open(newline="") as f:
        present: dict[str, set[str]] = defaultdict(set)
        for r in csv.DictReader(f):
            present[r["crop"]].add(r["class"])
    for crop in vc.TAXONOMY:
        if crop in maps:
            m = maps[crop]
            lines.append(
                f"  {crop:8} TRAINABLE  {m['num_classes']} classes: "
                + ", ".join(m["classes"]) + "."
                + (f"  (gap: {', '.join(m['excluded_taxonomy_classes'])})"
                   if m["excluded_taxonomy_classes"] else "")
            )
        else:
            n = len(present.get(crop, set()))
            why = "no images at all" if n == 0 else f"only {n} class present ({', '.join(sorted(present[crop]))})"
            lines.append(f"  {crop:8} SKIPPED    not trainable — {why}.")
    return lines


def main() -> int:
    ap = argparse.ArgumentParser(description="Emit present-only per-crop label maps for ML.")
    ap.add_argument("--print", dest="print_only", action="store_true",
                    help="print the maps to stdout only; do not write files.")
    args = ap.parse_args()

    maps = present_label_maps()

    if not args.print_only:
        LABEL_MAPS_DIR.mkdir(parents=True, exist_ok=True)
        for crop, m in maps.items():
            out = LABEL_MAPS_DIR / f"{crop}.json"
            out.write_text(json.dumps(m, indent=2) + "\n")
        print(f"Wrote {len(maps)} label map(s) to {vc.rel_to_root(LABEL_MAPS_DIR)}/")

    print("\nCrop status (v1):")
    for line in _all_crops_status(maps):
        print(line)

    print("\nPer-class image counts (train / val / test):")
    print(f"  {'crop':8} {'class':26} {'idx':>3} {'train':>6} {'val':>5} {'test':>5}")
    for crop, m in maps.items():
        for cls, idx in m["classes"].items():
            c = m["counts"][cls]
            print(f"  {crop:8} {cls:26} {idx:>3} {c['train']:6d} {c['val']:5d} {c['test']:5d}")

    if args.print_only:
        print("\n(--print: no files written)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
