# Vision dataset — data card

**Scope:** DATA PREPARATION for crop-conditioned image classification in agri-schema-my.
This card documents provenance, honesty caveats, known label-noise, and class status.
It does **not** cover model training or preprocessing (the user owns that phase).

## What this dataset is

- 6 crop-conditioned label sets (paddy, banana, chilli, tomato, rubber, cocoa); each crop
  is a small N-way problem plus a per-crop `healthy` class. Full taxonomy: `CLASSES.md`.
- Class names are exact KB `disease.name` slugs, so a prediction keys back into the KB via
  `GET /crops/{crop}/diseases/{slug}`.
- Images live under `images/<crop>/<class>/<source_dataset>/` and are **gitignored**;
  `manifest.csv`, `class_index/*.json`, `sources.yaml` and these docs are committed.

## Provenance & licensing

- Sourcing is hybrid — public datasets (Tier A/B) plus original field / licensed-web
  collection (Tier C). Per-source detail: `SOURCES.md` + `sources.yaml`.
- Every manifest row carries its `source_dataset`, `source_url`, and `license` for
  attribution. Project-contributed data is **CC BY 4.0**. Licences marked `verify: true`
  in `sources.yaml` must be confirmed on the source page before publishing.

## Honesty caveats (this project's ethos)

1. **Lab-vs-field bias.** PlantVillage (`plantvillage`) is single-leaf-on-plain-background
   lab imagery (`flags: [lab_bias]`). It generalises poorly to real farmer phone photos —
   always mix with PlantDoc/field data; never train a class on PlantVillage alone.
2. **Race 1 vs TR4.** Public banana Fusarium wilt images (`tanzania_banana_dataverse`,
   `nmaist_banana_zenodo`) are **Race 1, not the TR4 strain** devastating Malaysian
   Cavendish (`flags: [race1_not_tr4]`). The class is labelled `fusarium_wilt` and the
   Race-1 provenance is recorded — do not silently present it as TR4.
3. **Non-leaf organ classes.** `paddy/false_smut` (panicle) and `rubber/pink_disease`
   (stem/bark) are NOT leaf diseases. Collect organ-appropriate images. If organ-appropriate
   images can't be gathered, **drop the class from v1** rather than train on wrong-organ leaves.
4. **Diagnosis does not change the treatment honesty model.** The classifier only *selects
   which KB entry to show*; the KB's existing verified/unverified dose and PHI labels still apply.

## Acquired (2026-07-15) — 4 buildable crops, 25,150 images post-QA

Four crops reached a trainable state (≥ 2 classes incl. `healthy`). **Rubber and cocoa are
UNBUILDABLE in v1** — see the honest findings below. All splits are clean 70/15/15.

| Crop | Class | Source(s) | Post-QA | Split (train/val/test) |
|---|---|---|---|---|
| paddy | rice_blast | sethy + paddy_doctor | 1956 | 1369 / 293 / 294 |
| paddy | bacterial_leaf_blight | sethy + paddy_doctor | 937 | 656 / 141 / 140 |
| paddy | rice_tungro | sethy + paddy_doctor | 1365 | 955 / 205 / 205 |
| paddy | sheath_blight | mendeley_sheath_blight | 272 | 190 / 41 / 41 |
| paddy | healthy | paddy_doctor (`normal`) | 1552 | 1086 / 233 / 233 |
| tomato | early_blight | plantvillage + plantdoc | 1078 | 755 / 162 / 161 |
| tomato | late_blight | plantvillage + plantdoc | 2005 | 1404 / 301 / 300 |
| tomato | tomato_yellow_leaf_curl | plantvillage + plantdoc | 5559 | 3891 / 834 / 834 |
| tomato | healthy | plantvillage + plantdoc | 1630 | 1141 / 244 / 245 |
| banana | sigatoka_leaf_spot | tanzania_banana_dataverse | 2696 | 1887 / 404 / 405 |
| banana | fusarium_wilt (**Race 1**) | tanzania_banana_dataverse | 2491 | 1744 / 374 / 373 |
| banana | healthy | tanzania_banana_dataverse | 2860 | 2002 / 429 / 429 |
| chilli | anthracnose | mendeley_chilli_wzc6r6w5w5 | 324 | 227 / 49 / 48 |
| chilli | healthy | mendeley_chilli_wzc6r6w5w5 | 425 | 298 / 64 / 63 |

- **Honest findings:**
  - **paddy** — Sethy (fwcj7stb8r) heavily augmented; dedupe removed 2,730 near-dups + 228
    sub-224px (4,332 raw → 1,428 unique). Paddy Doctor field data clean. `sheath_blight` pulled
    from Mendeley hx6f852hw4 v1 (only the "Sheath Blight" class of 8; other rice classes ignored
    since blast/blb/tungro already sourced). Dropped non-KB classes (Brownspot, hispa, dead_heart,
    etc.). Kept stricter CC BY-SA 4.0 for the Paddy Doctor Kaggle mirror (tagged CC0 there).
  - **tomato** — mixed **lab (PlantVillage, CC0, single-leaf-on-plain-bg) + field (PlantDoc,
    CC BY 4.0)** for every class, per the lab-bias caveat — do NOT train tomato on PlantVillage
    alone. Dropped 1 ambiguous PlantDoc image that carried an identical pHash under both
    early_blight and late_blight (genuine field label noise — removed from both classes). Only
    the 3 KB-slug diseases + healthy were pulled from PlantVillage's `color/` subset; grayscale
    and segmented copies were NOT used.
  - **banana** — Harvard Dataverse doi:10.7910/DVN/LQUWXW (Tanzania, CC0). Fusarium imagery is
    **Race 1, NOT the TR4 strain** in Malaysian Cavendish — labelled `fusarium_wilt` with Race-1
    provenance recorded; do not present as TR4.
  - **chilli** — Mendeley wzc6r6w5w5 v3 field phone photos: Anthracnose + Fresh Leaf(→healthy)
    used; Cercospora / Leaf Curl (non-KB) dropped. It has **no powdery_mildew** class.
- **Split mode:** all classes fall to **per_image stratified fallback** (each has < 3 distinct
  source_datasets; tomato has 2). Sound post-dedupe (near-dups already removed). Adding a 3rd
  source per class would restore full source-grouped splitting.

## Tier-C GAPS still open + crops dropped from v1

- **rubber — UNBUILDABLE.** BDRubberLeaf (Mendeley 4kjz78m7x5 v4) was pulled but its classes are
  Anthracnose / Dry_Leaf / Healthy / Leaf_Spot — it has **no powdery_mildew** (earlier research
  claim was wrong) and none of its disease classes map to rubber's KB slugs
  (`powdery_mildew`, `pink_disease`). Only `healthy` matched, which can't train a classifier
  alone → rubber dropped from v1.
- **cocoa — UNBUILDABLE.** `vascular_streak_dieback` has no public dataset (Malaysian plantation
  collection needed). Only a `healthy` class could be sourced → dropped from v1.
- **chilli/powdery_mildew** — no confirmed public source. The plan pointed it at Mendeley
  tm3v4zmh7c, but that dataset is Bacterial_Spot/Cercospora/Curl_Virus/Healthy — no powdery
  mildew. Gap.
- **chilli/bacterial_wilt, banana/banana_bunchy_top, tomato/bacterial_canker, rubber/pink_disease,
  paddy/false_smut (panicle)** — no usable public imagery; original field / licensed-web
  collection required. `dedupe_qa.py` flags every empty/under-min class so the gap stays visible.

## Class status (Tier → collection expectation)

- **Tier A (build first):** paddy rice_blast / bacterial_leaf_blight / rice_tungro;
  banana sigatoka_leaf_spot; tomato early_blight / late_blight / tomato_yellow_leaf_curl.
- **Tier B (partial — supplement):** paddy sheath_blight; chilli anthracnose / powdery_mildew;
  rubber powdery_mildew; banana fusarium_wilt (Race-1 caveat above).
- **Tier C (GAP — needs original collection, may not reach a trainable count):**
  banana banana_bunchy_top, chilli bacterial_wilt, tomato bacterial_canker,
  rubber pink_disease, cocoa vascular_streak_dieback, paddy false_smut.
  `dedupe_qa.py` flags every class under the minimum count — expect all Tier-C classes to
  flag until collection catches up. Surfacing the gap is the point; do not ship a model that
  silently can't see these classes.

## Data-prep pipeline (scripts under `scripts/vision/`, run by the user)

1. `build_manifest.py --scaffold` — validate taxonomy vs KB, create class folders, write
   `class_index/*.json`.
2. Acquire images into `images/<crop>/<class>/<source_dataset>/` (Tier A/B downloads, Tier C
   field/web); register each source folder in `sources.yaml`.
3. `dedupe_qa.py` — perceptual-hash dedupe, resolution floor, corrupt-file + per-class count
   report (report-only; `--apply` deletes). Flags classes below the minimum.
4. `build_manifest.py` — walk images, write `manifest.csv` (auto-fills kb_disease_slug /
   pathogen_type from the KB and source_url / license / organ from `sources.yaml`).
5. `split_dataset.py` — stratified per-class 70/15/15, **grouped by source_dataset** so no
   source straddles splits; writes the `split` column. **Single-source fallback:** a class
   with fewer than 3 distinct source_datasets cannot fill val/test by whole-group assignment,
   so it falls back to a per-image stratified split within the class. This is sound because
   `dedupe_qa.py` has already removed the near-duplicate images that are the real leakage
   vector; residual same-scene images (pHash above the dedupe threshold) are a mild, documented
   risk. Add a second/third source per class to restore full source-grouped splitting.
6. **Handoff to ML (not implemented here):** deliver raw variable-size images + `manifest.csv`;
   the ML side does resize/normalise/augment in its dataloader and reads splits from the manifest.
   `class_index/<crop>.json` gives a stable class→int ordering so model outputs map back to slugs.

## Manifest columns

`path, crop, class, kb_disease_slug, pathogen_type, source_dataset, source_url, license,
organ, split, phash` — see `scripts/vision/vision_common.py::MANIFEST_COLUMNS`.
