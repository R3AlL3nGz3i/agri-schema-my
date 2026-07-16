#!/usr/bin/env python3
"""
dedupe_qa.py — QA + clean the raw image tree BEFORE building the manifest.

DATA-PREP ONLY. Operates directly on files under data/vision/images/.

Checks (report-only by default; pass --apply to actually delete):
  1. Corrupt / unreadable / non-image files            -> report (delete with --apply)
  2. Below the resolution floor (short side < --min-side, default 224px) -> report (delete with --apply)
  3. Near-duplicate images WITHIN each (crop, class)    -> keep one, report the rest
                                                           (delete extras with --apply)
  4. EXACT-hash collisions ACROSS classes (label conflict) -> always reported, never
                                                           auto-deleted (needs a human)
  5. Per-class counts, flagging any class below --min-count (default 150) as
     "needs more collection" (expected for every Tier-C class).

Near-duplicate = pHash Hamming distance <= --dup-threshold (default 5).
Deletions are the ONLY destructive action and require --apply; the default run
changes nothing on disk.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vision_common as vc


def _short_side(img) -> int:
    return min(img.size)


def run(min_side: int, min_count: int, dup_threshold: int, apply: bool) -> int:
    corrupt: list[Path] = []
    low_res: list[tuple[Path, int]] = []
    # (crop, class) -> list[(path, phash)]
    by_class: dict[tuple[str, str], list[tuple[Path, str]]] = defaultdict(list)
    phash_index: dict[str, list[tuple[str, str, Path]]] = defaultdict(list)  # exact phash -> occurrences

    for img in vc.iter_image_files():
        crop, cls, _source = vc.parse_image_path(img)
        pil = vc.open_image(img)
        if pil is None:
            corrupt.append(img)
            continue
        if _short_side(pil) < min_side:
            low_res.append((img, _short_side(pil)))
            # still hash it so dedupe sees it; it will be dropped anyway if --apply
        ph = vc.compute_phash(img)
        by_class[(crop, cls)].append((img, ph))
        phash_index[ph].append((crop, cls, img))

    # 3. near-duplicate detection within each class (greedy: keep first, drop close others)
    dup_extras: list[tuple[Path, Path]] = []  # (extra_to_drop, kept)
    for (crop, cls), items in by_class.items():
        kept: list[tuple[Path, str]] = []
        for path, ph in items:
            match = next((k for k, kph in kept if vc.hamming(ph, kph) <= dup_threshold), None)
            if match is not None:
                dup_extras.append((path, match))
            else:
                kept.append((path, ph))

    # 4. exact-hash collisions spanning >1 class (label conflict)
    cross_class_conflicts: list[tuple[str, list[tuple[str, str, Path]]]] = []
    for ph, occ in phash_index.items():
        if not ph:
            continue
        classes = {(c, cl) for c, cl, _ in occ}
        if len(classes) > 1:
            cross_class_conflicts.append((ph, occ))

    # ---- report ----
    print("=" * 68)
    print("dedupe_qa report" + ("  [--apply: deletions WILL be made]" if apply else "  [dry run — no files changed]"))
    print("=" * 68)

    print(f"\n[1] Corrupt / unreadable files: {len(corrupt)}")
    for p in corrupt:
        print(f"    - {vc.rel_to_root(p)}")

    print(f"\n[2] Below resolution floor (short side < {min_side}px): {len(low_res)}")
    for p, side in low_res:
        print(f"    - {vc.rel_to_root(p)}  ({side}px)")

    print(f"\n[3] Near-duplicate extras within a class (pHash <= {dup_threshold}): {len(dup_extras)}")
    for extra, kept in dup_extras:
        print(f"    - drop {vc.rel_to_root(extra)}  (dup of {vc.rel_to_root(kept)})")

    print(f"\n[4] EXACT cross-class label conflicts (NEVER auto-deleted): {len(cross_class_conflicts)}")
    for ph, occ in cross_class_conflicts:
        locs = ", ".join(f"{c}/{cl}:{p.name}" for c, cl, p in occ)
        print(f"    - phash {ph}: {locs}")

    # 5. per-class counts (post-dedupe, excluding corrupt/low-res that would be dropped)
    drop_set = set(corrupt) | {p for p, _ in low_res} | {p for p, _ in dup_extras}
    print(f"\n[5] Per-class counts (after would-be removals), flag < {min_count}:")
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for (crop, cls), items in by_class.items():
        counts[(crop, cls)] = sum(1 for p, _ in items if p not in drop_set)
    # include declared-but-empty classes
    for crop, specs in vc.TAXONOMY.items():
        for spec in specs:
            counts.setdefault((crop, spec.name), 0)
    flagged = 0
    for (crop, cls) in sorted(counts):
        n = counts[(crop, cls)]
        flag = "  <-- BELOW MINIMUM (collect more)" if n < min_count else ""
        if n < min_count:
            flagged += 1
        print(f"    {crop:8} {cls:26} {n:5d}{flag}")
    print(f"\n    {flagged} class(es) below the {min_count}-image minimum.")

    # ---- apply deletions ----
    if apply:
        removed = 0
        for p in drop_set:
            try:
                p.unlink()
                removed += 1
            except OSError as e:
                print(f"    ! could not delete {p}: {e}")
        print(f"\n[--apply] Deleted {removed} file(s) "
              f"(corrupt + low-res + near-dup extras). Cross-class conflicts left for review.")
        print("          Re-run build_manifest.py to refresh manifest.csv.")
    else:
        n_would = len(drop_set)
        print(f"\n[dry run] {n_would} file(s) WOULD be deleted with --apply "
              f"(corrupt + low-res + near-dup extras).")

    # exit non-zero if unresolved cross-class conflicts exist (a human must fix labels)
    return 1 if cross_class_conflicts else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="QA + dedupe the raw vision image tree.")
    ap.add_argument("--min-side", type=int, default=224, help="Resolution floor, short side px (default 224).")
    ap.add_argument("--min-count", type=int, default=150, help="Flag classes below this count (default 150).")
    ap.add_argument("--dup-threshold", type=int, default=5, help="pHash Hamming distance for near-dup (default 5).")
    ap.add_argument("--apply", action="store_true", help="Actually delete corrupt/low-res/near-dup files.")
    args = ap.parse_args()
    return run(args.min_side, args.min_count, args.dup_threshold, args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
