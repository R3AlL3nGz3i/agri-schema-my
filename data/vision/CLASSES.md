# Vision v1 — crop-conditioned label taxonomy

Image classification is **crop-conditioned**: the farmer picks the crop from the UI
dropdown first, so each crop is its own small N-way problem (not one flat 23-way model).
Every class below is either the **exact `disease.name` slug** from
`data/crops/<crop>/diseases/<slug>.yaml` (so a prediction keys straight back into the KB
via `GET /crops/{crop}/diseases/{slug}`) or a per-crop `healthy` class (no KB entry).

The machine-readable source of truth is `TAXONOMY` in
`scripts/vision/vision_common.py`; `build_manifest.py --scaffold` validates every
non-`healthy` class against the KB and fails loudly on any typo/mismatch.

## On-disk layout (images are gitignored)

```
data/vision/images/<crop>/<class>/<source_dataset>/*.jpg
```

The `<source_dataset>` level is **required** — it feeds `source_url`/`license` from
`sources.yaml` into the manifest and lets `split_dataset.py` keep each source inside a
single split (leakage guard).

## Classes

| Crop | Class (KB slug) | KB slug maps to | Organ | Note |
|---|---|---|---|---|
| paddy | rice_blast | `paddy/rice_blast.yaml` | leaf | |
| paddy | bacterial_leaf_blight | `paddy/bacterial_leaf_blight.yaml` | leaf | |
| paddy | sheath_blight | `paddy/sheath_blight.yaml` | leaf | |
| paddy | rice_tungro | `paddy/rice_tungro.yaml` | leaf | |
| paddy | false_smut | `paddy/false_smut.yaml` | **panicle** | NON-LEAF — collect panicle images |
| paddy | healthy | — | leaf | |
| banana | sigatoka_leaf_spot | `banana/sigatoka_leaf_spot.yaml` | leaf | |
| banana | fusarium_wilt | `banana/fusarium_wilt.yaml` | whole_plant | public images = **Race 1, not TR4** |
| banana | banana_bunchy_top | `banana/banana_bunchy_top.yaml` | whole_plant | |
| banana | healthy | — | leaf | |
| chilli | anthracnose | `chilli/anthracnose.yaml` | fruit | |
| chilli | powdery_mildew | `chilli/powdery_mildew.yaml` | leaf | |
| chilli | bacterial_wilt | `chilli/bacterial_wilt.yaml` | whole_plant | |
| chilli | healthy | — | leaf | |
| tomato | early_blight | `tomato/early_blight.yaml` | leaf | |
| tomato | late_blight | `tomato/late_blight.yaml` | leaf | |
| tomato | tomato_yellow_leaf_curl | `tomato/tomato_yellow_leaf_curl.yaml` | leaf | |
| tomato | bacterial_canker | `tomato/bacterial_canker.yaml` | leaf | |
| tomato | healthy | — | leaf | |
| rubber | powdery_mildew | `rubber/powdery_mildew.yaml` | leaf | |
| rubber | pink_disease | `rubber/pink_disease.yaml` | **stem** | NON-LEAF — collect stem/bark images |
| rubber | healthy | — | leaf | |
| cocoa | vascular_streak_dieback | `cocoa/vascular_streak_dieback.yaml` | leaf | |
| cocoa | healthy | — | leaf | |

## Dropped from v1 (not classifiable from a field photo)

- **oil_palm / ganoderma_basal_stem_rot** — no early external leaf symptoms (basal stem rot).
- **rubber / south_american_leaf_blight** — quarantine pest, absent from Malaysia.
- **durian / phytophthora_root_rot**, **durian / patch_canker** — below-ground / trunk.
- **paddy / brown_plant_hopper** — insect pest, not a leaf-symptom disease.

This drops **durian** and **oil_palm** entirely from v1, leaving **6 crop-conditioned
label sets** (paddy, banana, chilli, tomato, rubber, cocoa).

Stable class→int maps for model outputs are written per crop to
`data/vision/class_index/<crop>.json` by `build_manifest.py --scaffold`.
