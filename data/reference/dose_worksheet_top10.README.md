# Top-10 dose verification worksheet

`dose_worksheet_top10.csv` is a human worksheet for capturing **authoritative
pesticide label doses** for the 10 highest-leverage food-crop treatments in the
knowledge base. It exists because the current 46 doses are all AI-estimated
(`dosage_grounding.verified: false`) — no public Malaysian source carries label
doses (`mypesticide.doa.gov.my` is login-gated), so a human with portal access
must transcribe them.

The 10 rows were chosen by: fresh-eaten food crops first (tomato, chilli,
banana), the rice staple, and the highest-frequency compounds (mancozeb ×3,
plus hexaconazole, propiconazole, chlorothalonil, imidacloprid, thiamethoxam,
tricyclazole, metalaxyl combo). All are foliar sprays with real dietary
residue exposure. Non-food (rubber) and no-residue applications (soil drenches,
corm dips, bark paints) are deliberately excluded.

## How to fill it

The columns match `pipeline/doa_registry.py` `REQUIRED_COLUMNS` exactly, so a
filled copy feeds `ingest_doa_registry()` with zero transformation.

Pre-filled (identity — do not change): `active_ingredient`, `trade_name`,
`crop`, `target`.

**You fill (authoritative only):**

| column | what to enter |
|---|---|
| `dosage` | the exact label rate for this product-crop use (e.g. `2.0 g/L` or `1.6 kg/ha`). **Transcribe from the registered label — never copy `_ai_estimate_dosage`.** |
| `phi_days` | the label pre-harvest interval (TDMH) in days. |
| `registration_no` | the DOA / LPRMP registration number. |
| `approval_status` | e.g. `registered`. |
| `source_url` | the authoritative page, **must be on a `doa.gov.my` domain** (e.g. `https://mymrl.doa.gov.my/AIs/28`). |
| `retrieved_date` | ISO date you retrieved it, e.g. `2026-07-11`. |

Reference-only columns are prefixed `_` (`_disease`, `_ai_estimate_dosage`,
`_ai_estimate_phi_days`, `_phi_status`, `_fill_notes`). The ingestion pipe
**ignores** them — they are context for the person filling the sheet.

## Why `dosage`/`phi_days` start blank

`build_products()` copies `dosage`/`phi_days` verbatim into the fact table. If
the AI estimate were pre-filled there and left un-overwritten, the pipe would
publish an AI guess as an authoritative fact — the exact "authority-washing"
this project is eliminating. The estimate is quarantined in `_ai_estimate_*`
so it can never leak through.

## When done

1. Save the filled sheet to `data/reference/sources/doa_registry_raw.csv`
   (gitignored — your licensed/portal export is not committed).
2. Run `python -m pipeline.doa_registry`.
3. `_validate_authoritative` is fail-closed: the registry is only marked
   `authoritative` if **every** row has `registration_no` + `retrieved_date` +
   a `doa.gov.my` `source_url`. Any gap → `status: draft`, gate stays disabled.
   A partially-filled sheet is safe — it just stays draft.
