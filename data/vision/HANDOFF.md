# ML handoff — image classification

This is the contract between the DATA-PREP phase (owned here) and the MODEL/TRAINING
phase (owned by the ML side). Data prep stops at a clean, labelled, split dataset +
manifests. Training, preprocessing, and the `/diagnose` endpoint are NOT implemented here.

## TL;DR
- Train **one classifier per crop** (crop is already chosen from the UI dropdown).
- **Labels live in `manifest.csv` (`class` column)** = exact KB disease slug, or `healthy`.
- **Use `label_maps/<crop>.json` for the int mapping — NOT `class_index/<crop>.json`.**
  The `class_index` files list the full taxonomy incl. empty classes; `label_maps` are
  present-only and contiguous.
- **Read the `split` column as-is. Do NOT re-split** (it enforces the leakage guard).
- **4 crops are trainable** (paddy, tomato, banana, chilli). rubber + cocoa have no data.

## Where the labels are

`manifest.csv` columns (see `scripts/vision/vision_common.py::MANIFEST_COLUMNS`):

| column | use |
|---|---|
| `path` | image location, posix, relative to repo root |
| `crop` | which per-crop model this row belongs to |
| **`class`** | **the label** — KB `disease.name` slug, or `healthy` |
| `kb_disease_slug` | == `class` for a disease, empty for `healthy` (KB key) |
| `pathogen_type` | fungal / bacterial / viral (from KB), empty for healthy |
| `source_dataset` | provenance key into `sources.yaml` |
| `source_url`, `license` | attribution — keep for redistribution |
| `organ` | leaf / fruit / panicle / stem / whole_plant |
| **`split`** | **train / val / test — already assigned, use directly** |
| `phash` | perceptual hash (dedupe bookkeeping; ignore for training) |

### Integer label map — use `label_maps/`, not `class_index/`
`class_index/<crop>.json` is the full v1 taxonomy and **includes classes with zero
images** (paddy `false_smut`, tomato `bacterial_canker`, etc.) plus crops with no data.
Training against it gives dead output neurons.

Regenerate the present-only maps any time with:

```
python scripts/vision/train_labels.py          # writes data/vision/label_maps/<crop>.json
python scripts/vision/train_labels.py --print   # preview only, writes nothing
```

Each `label_maps/<crop>.json` gives a contiguous `classes: {name: idx}` (taxonomy order,
`healthy` last), `num_classes`, per-class `counts`, and the `excluded_taxonomy_classes`
gaps. Import it directly, or call `train_labels.present_label_maps()` from Python.

## What is / isn't covered (v1)

| Crop | Trainable classes (idx from `label_maps/`) | Gap classes (no images) |
|---|---|---|
| paddy | rice_blast, bacterial_leaf_blight, sheath_blight, rice_tungro, healthy | false_smut (panicle) |
| tomato | early_blight, late_blight, tomato_yellow_leaf_curl, healthy | bacterial_canker |
| banana | sigatoka_leaf_spot, fusarium_wilt, healthy | banana_bunchy_top |
| chilli | anthracnose, healthy | powdery_mildew, bacterial_wilt |
| rubber | — **not trainable** — | powdery_mildew, pink_disease (no public data) |
| cocoa | — **not trainable** — | vascular_streak_dieback (no public data) |

The app must **fall back to the text `POST /query` flow** for the 2 unbuildable crops and
every gap class — never claim to diagnose a class the model was never trained on.

## Training notes (ML side owns these)

1. **Per-crop models.** Filter `manifest.csv` by `crop`; one N-way head per crop using the
   `label_maps/<crop>.json` ordering.
2. **Splits are fixed.** Group rows by the `split` column. Re-shuffling leaks near-duplicate
   / same-source images across train↔test (the split was source-grouped where possible,
   per-image stratified elsewhere — see `DATA_CARD.md`).
3. **Preprocess in the dataloader.** Images are delivered raw / variable-size on purpose —
   do resize / normalise / augment yourself.
4. **Class imbalance is real.** e.g. tomato `tomato_yellow_leaf_curl` 5559 vs chilli
   `anthracnose` 324. Use class-weighted loss or balanced sampling; report per-class metrics,
   not just top-1 accuracy.
5. **Honesty caveats (`DATA_CARD.md`) affect evaluation, not just training:**
   - tomato mixes lab (PlantVillage, plain-bg) + field (PlantDoc) — good; hold out field for
     a realistic val signal.
   - **chilli is detached-leaf-on-plain-paper**, not in-canopy — it will likely NOT transfer
     to real in-field phone photos. Validate on field images before trusting it.
   - banana `fusarium_wilt` images are **Race 1, NOT TR4** — surface that provenance; do not
     present a positive as TR4.
6. **Output maps back to the KB.** The model emits an int → `label_maps` gives the `class`
   string → for a disease that string IS the KB slug: `GET /crops/{crop}/diseases/{class}`.
   `healthy` has no KB entry (short-circuit it). The existing verified/unverified dose + PHI
   honesty labels in the KB are unchanged — the classifier only *selects which KB entry to show*.
