# Contributing to AgriSchema-MY

Thank you for contributing to Malaysia's open crop disease knowledge base.

## What We Need

- New disease entries for Malaysian crops
- Corrections to existing entries (especially dosages and citations)
- Malay local names (`local_name`) for diseases that are missing them
- Updated regulatory status when compound approvals change

## Entry Format

Each entry must follow the schema exactly. See `README.md` for the full structure.

**Mandatory fields:**
- `crop` — lowercase, underscores (e.g. `oil_palm`)
- `disease.name` — snake_case
- `disease.local_name` — Bahasa Malaysia term used by farmers
- `disease.pathogen.type` — one of: `fungi`, `bacteria`, `virus`, `pest`, `nematode`, `oomycete`, `abiotic`, `unknown`
- `disease.symptoms.visual` — at least one item
- `disease.treatments` — at least one entry with `compound`, `dosage`, `regulatory_status`
- `disease.source_citations` — at least one primary source (MARDI, DOA, FAO, or EPPO)
- `disease.confidence_score` — float 0.0–1.0

**Regulatory status values:**
- `MY_approved` — registered under Pesticide Act 1974 (Akta Racun Perosak 1974)
- `MY_restricted` — restricted use, licensed applicator required
- `MY_banned` — banned in Malaysia
- `unknown` — status not confirmed

## File Location

Place your entry at:
```
data/crops/{crop}/diseases/{disease_name}.yaml
```

Example: `data/crops/paddy/diseases/brown_spot.yaml`

## Submission Process

1. Fork this repository
2. Add or edit your YAML file
3. Submit a pull request
4. CI will run schema validation automatically
5. Maintainers will run Professor Agent review

Entries with critical errors (wrong dosage, banned compound listed as approved, fabricated citations) will be rejected.

## Citation Standards

Acceptable primary sources:
- MARDI bulletins and technical reports (cite bulletin number and year)
- Jabatan Pertanian Malaysia (DOA) advisories
- FAO AGROVOC entries
- EPPO datasheets
- Peer-reviewed journals (include DOI)

Do **not** cite Wikipedia, farming blogs, or unattributed web content.

## Questions

Open a GitHub Issue if you are unsure about a field or need guidance on a specific crop or disease.
