#!/usr/bin/env python3
"""
split_dataset.py — assign a stratified, source-grouped train/val/test split.

DATA-PREP ONLY. Reads and rewrites the `split` column of data/vision/manifest.csv.
No images are copied or moved — the ML dataloader reads images by their `split`.

Strategy
  * Stratified per (crop, class): each class is split ~70/15/15.
  * GROUPED by source_dataset: every (crop, class, source_dataset) group is placed
    ENTIRELY into ONE split. Identical-source / near-duplicate images can never
    straddle train and test (leakage guard). Ratios are therefore best-effort,
    achieved by greedily assigning each group (largest first) to whichever split
    is furthest below its per-class target.
  * Deterministic given --seed (default 42): group processing order is stably
    shuffled by a hash of (seed, crop, class, source_dataset).

After writing, the script ASSERTS that no source_dataset group spans two splits
within a class, and prints the achieved per-class ratios.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vision_common as vc

SPLITS = ("train", "val", "test")


def _order_key(seed: int, crop: str, cls: str, source: str) -> str:
    return hashlib.sha256(f"{seed}|{crop}|{cls}|{source}".encode()).hexdigest()


# A class needs at least this many distinct source_dataset groups for the
# source-grouped (leakage-guard) split to be able to fill train/val/test. Below
# this, whole-group assignment would starve val/test, so we fall back to a
# per-image stratified split WITHIN the class. That fallback is sound here because
# dedupe_qa.py has already removed the near-duplicate images that are the real
# leakage vector; residual same-scene images (pHash > threshold) are a mild,
# documented risk (see DATA_CARD.md).
GROUP_MIN_SOURCES = 3


def assign_splits(
    rows: list[dict], ratios: tuple[float, float, float], seed: int
) -> tuple[dict[str, str], dict[tuple[str, str], str]]:
    """Return ({path: split}, {(crop,class): "grouped"|"per_image"})."""
    grouped: dict[tuple[str, str], dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        grouped[(r["crop"], r["class"])][r["source_dataset"]].append(r["path"])

    assignment: dict[str, str] = {}
    mode: dict[tuple[str, str], str] = {}
    for (crop, cls), by_source in grouped.items():
        total = sum(len(p) for p in by_source.values())
        targets = {s: total * ratios[i] for i, s in enumerate(SPLITS)}
        filled = {s: 0 for s in SPLITS}

        if len(by_source) >= GROUP_MIN_SOURCES:
            # source-grouped: whole groups, largest first, into the biggest deficit.
            mode[(crop, cls)] = "grouped"
            source_items = sorted(
                by_source.items(),
                key=lambda kv: (-len(kv[1]), _order_key(seed, crop, cls, kv[0])),
            )
            for source, paths in source_items:
                best = max(SPLITS, key=lambda s: (targets[s] - filled[s], -SPLITS.index(s)))
                for p in paths:
                    assignment[p] = best
                filled[best] += len(paths)
        else:
            # per-image stratified fallback (deterministic order by hash of seed+path).
            mode[(crop, cls)] = "per_image"
            all_paths = sorted(
                (p for paths in by_source.values() for p in paths),
                key=lambda p: hashlib.sha256(f"{seed}|{p}".encode()).hexdigest(),
            )
            n = len(all_paths)
            n_train = round(n * ratios[0])
            n_val = round(n * ratios[1])
            for i, p in enumerate(all_paths):
                if i < n_train:
                    assignment[p] = "train"
                elif i < n_train + n_val:
                    assignment[p] = "val"
                else:
                    assignment[p] = "test"
    return assignment, mode


def main() -> int:
    ap = argparse.ArgumentParser(description="Stratified, source-grouped train/val/test split.")
    ap.add_argument("--train", type=float, default=0.70)
    ap.add_argument("--val", type=float, default=0.15)
    ap.add_argument("--test", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    ratios = (args.train, args.val, args.test)
    if abs(sum(ratios) - 1.0) > 1e-6:
        raise SystemExit(f"Ratios must sum to 1.0 (got {sum(ratios)}).")

    if not vc.MANIFEST_PATH.exists():
        raise SystemExit(f"{vc.MANIFEST_PATH} not found. Run build_manifest.py first.")

    with vc.MANIFEST_PATH.open(newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise SystemExit("manifest.csv has no image rows yet — nothing to split.")

    assignment, mode = assign_splits(rows, ratios, args.seed)
    for r in rows:
        r["split"] = assignment.get(r["path"], "")

    with vc.MANIFEST_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=vc.MANIFEST_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    # ---- assert grouping invariant for GROUPED classes only ----
    # (per_image-fallback classes intentionally split one source across splits.)
    group_splits: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    for r in rows:
        group_splits[(r["crop"], r["class"], r["source_dataset"])].add(r["split"])
    violations = {
        g: s for g, s in group_splits.items()
        if len(s) > 1 and mode.get((g[0], g[1])) == "grouped"
    }
    if violations:
        raise SystemExit(
            "LEAKAGE INVARIANT VIOLATED — a source_dataset group spans multiple splits:\n  - "
            + "\n  - ".join(f"{g}: {sorted(s)}" for g, s in violations.items())
        )

    # ---- report achieved ratios per class ----
    per_class: dict[tuple[str, str], dict[str, int]] = defaultdict(lambda: {s: 0 for s in SPLITS})
    for r in rows:
        per_class[(r["crop"], r["class"])][r["split"]] += 1
    print(f"Split written to {vc.rel_to_root(vc.MANIFEST_PATH)}  "
          f"(target {ratios[0]:.0%}/{ratios[1]:.0%}/{ratios[2]:.0%}, seed {args.seed})")
    print("  grouped-mode classes: no source_dataset spans two splits (leakage invariant holds).")
    fallbacks = sorted(k for k, m in mode.items() if m == "per_image")
    if fallbacks:
        print(f"  per_image-fallback classes (< {GROUP_MIN_SOURCES} sources; safe post-dedupe): "
              + ", ".join(f"{c}/{cl}" for c, cl in fallbacks))
    print()
    print(f"  {'crop':8} {'class':26} {'mode':10} {'train':>6} {'val':>5} {'test':>5}  ratios")
    for (crop, cls) in sorted(per_class):
        c = per_class[(crop, cls)]
        n = sum(c.values())
        if n == 0:
            continue
        r_ = "/".join(f"{c[s] / n:.0%}" for s in SPLITS)
        print(f"  {crop:8} {cls:26} {mode.get((crop, cls), '-'):10} "
              f"{c['train']:6d} {c['val']:5d} {c['test']:5d}  {r_}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
