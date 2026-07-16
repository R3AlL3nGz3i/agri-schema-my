# Vision dataset — researched source shortlist

Hybrid sourcing: public datasets where a real one maps to our pathogen, plus original
field / licensed-web collection for the Malaysia-specific gaps. The machine-readable
registry (folder key → url/license/organ) is `data/vision/sources.yaml`; this file is
the human rationale + per-source licence notes.

**You** perform the downloads and field collection under your own Kaggle / Mendeley /
Dataverse accounts and confirm each licence before publishing. Every `verify: true`
entry in `sources.yaml` still needs its exact terms checked on the source page.

## Tier A — GOOD public field data, build first

| Source (folder key) | Classes | Type | Licence (verify) |
|---|---|---|---|
| `paddy_doctor` | paddy: rice_blast, bacterial_leaf_blight, rice_tungro | field (India, ~16k) | CC BY-SA 4.0 |
| `sethy_rice_mendeley` | paddy: rice_blast, bacterial_leaf_blight, rice_tungro | field (India) | CC BY 4.0 |
| `tanzania_banana_dataverse` | banana: sigatoka_leaf_spot, fusarium_wilt | field (Tanzania, ~16k) | CC BY 4.0 |
| `nmaist_banana_zenodo` | banana: sigatoka_leaf_spot, fusarium_wilt | field (~11.7k) | CC BY 4.0 |
| `plantvillage` | tomato: early_blight, late_blight, tomato_yellow_leaf_curl | **lab** | CC0 1.0 |
| `plantdoc` | tomato: early_blight, late_blight | field | CC BY 4.0 |

## Tier B — PARTIAL (small / lab-only; supplement with field/web)

| Source (folder key) | Classes | Type | Licence (verify) |
|---|---|---|---|
| `mendeley_sheath_blight` (hx6f852hw4) | paddy: sheath_blight | lab | CC BY 4.0 |
| `mendeley_chilli_anthracnose` (wzc6r6w5w5) | chilli: anthracnose (Colletotrichum) | mixed | CC BY 4.0 |
| `mendeley_chilli_powdery` (tm3v4zmh7c) | chilli: powdery_mildew | mixed | CC BY 4.0 |
| `bdrubberleaf` | rubber: powdery_mildew | field (~480) | CC BY 4.0 |
| `tanzania_banana_dataverse` / `nmaist_banana_zenodo` | banana: fusarium_wilt | field | **Race 1 only, NOT TR4** |

## Tier C — GAP, requires original field / licensed-web collection

Use `field_collection` (your own photos) first; `web_licensed` (iNaturalist / Plantwise /
extension libraries) only for CC-licensed or permission-granted images, recording each
image's licence individually.

| Class | Public availability | Plan |
|---|---|---|
| banana: banana_bunchy_top | ~134 images only | field collection |
| chilli: bacterial_wilt | none | field collection |
| tomato: bacterial_canker | none (PlantVillage has *spot*, not canker) | field collection |
| rubber: pink_disease | none (bark disease) | field collection, **stem/bark organ** |
| cocoa: vascular_streak_dieback | none public | Malaysian plantation collection |
| paddy: false_smut | partial (panicle) | field/web, **panicle organ** |

## Honesty flags carried into the manifest / DATA_CARD

- **`plantvillage` = lab, single leaf on plain background** → generalisation risk; always
  mix with `plantdoc`/field, never train on PlantVillage alone.
- **Banana Fusarium public images are Race 1, not TR4** → labelled as such (`flags:
  [race1_not_tr4]`); do not silently call them TR4.
- Every image row keeps its `source_dataset` + `license` for attribution (project data is
  CC BY 4.0).
- Image diagnosis does **not** change the dose/PHI honesty model — the classifier only
  *selects which KB entry to show*; the existing verified/unverified treatment labels still apply.
