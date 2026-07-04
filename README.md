# AgriSchema-MY

**The first open-source, structured crop disease knowledge base for Malaysian agriculture.**

Validated, machine-readable disease and treatment data — built for AI systems, researchers, and agricultural technology applications.

---

## Why This Exists

Malaysia's agricultural knowledge is scattered across government bulletins, research journals, and institutional reports — published in PDFs, inaccessible to AI systems, and unavailable in a structured format that developers or researchers can actually use.

**AgriSchema-MY changes that.**

We extract, structure, validate, and publish crop disease data from authoritative Malaysian sources — MARDI, Jabatan Pertanian, FAO AGROVOC, and EPPO — into a clean, versioned, citable YAML schema that any system can consume.

---

## Why This Is Valuable

### For AI Developers
A structured, validated knowledge base that AI systems can query directly — no scraping, no parsing, no hallucination risk from ungrounded models. Every entry has a source citation, confidence score, and peer-reviewed validation.

### For Agronomists & Researchers
A citable, community-maintained dataset with traceable provenance. Every entry links back to a primary source (MARDI bulletin, DOA advisory, FAO record). Easy to contribute, easy to dispute, easy to improve.

### For AgriTech Builders
Build pest identification apps, treatment recommendation engines, and precision farming tools on top of a dataset that is accurate for Malaysian conditions — not adapted from datasets built for temperate climates.

### For Government & Institutions
An openly auditable record of crop disease intelligence that can feed into policy tools, early warning systems, and digital agriculture initiatives without vendor lock-in.

---

## The Dataset

**16 validated entries across 8 major Malaysian crops:**

| Crop | Diseases Covered |
|---|---|
| **Paddy (Padi)** | Rice blast, bacterial leaf blight, sheath blight, brown planthopper |
| **Durian** | Phytophthora root rot, patch canker |
| **Banana (Pisang)** | Fusarium wilt (Panama disease), banana bunchy top virus |
| **Chilli (Cili)** | Anthracnose, bacterial wilt |
| **Tomato (Tomato)** | Early blight, late blight |
| **Rubber (Getah)** | Powdery mildew, South American leaf blight |
| **Oil Palm (Kelapa Sawit)** | Ganoderma basal stem rot |
| **Cocoa (Koko)** | Vascular streak dieback |

Each entry includes:
- **Disease identity** — name (English + Malay local name), pathogen species, pathogen type
- **Symptom profile** — visual indicators, severity stages, growth impact
- **Treatment protocols** — compounds, dosages, application methods, pre-harvest intervals
- **Regulatory status** — `MY_approved`, `MY_restricted`, or `MY_banned` per Malaysian law
- **Source citations** — traceable to primary MARDI or DOA publications
- **Confidence score** — 0.0–1.0, adjusted by AI agronomist review
- **Quality gate verdict** — PASS / FLAG / REJECT from Professor Agent review

**Primary sources:**
- [MARDI](https://www.mardi.gov.my) — Malaysian Agricultural Research and Development Institute
- [Jabatan Pertanian Malaysia](https://www.doa.gov.my) — Department of Agriculture Malaysia
- [FAO AGROVOC](https://agrovoc.fao.org) — UN multilingual agricultural thesaurus
- [EPPO](https://gd.eppo.int) — European and Mediterranean Plant Protection Organization

---

## Schema

Every entry follows a consistent, versioned structure:

```yaml
crop: paddy
disease:
  name: rice_blast
  local_name: penyakit blas padi
  pathogen:
    type: fungi
    species: Magnaporthe oryzae
  symptoms:
    visual:
      - diamond-shaped lesions with grey centre and brown border
    growth: yield loss 20-80% in severe cases
  severity_stages:
    - stage: early
      signs: small brown specks less than 2mm
  treatments:
    - compound: Tricyclazole
      trade_name: Beam 75WP
      dosage: 0.5g per litre water
      method: foliar spray
      frequency: twice weekly
      pre_harvest_interval_days: 14
      regulatory_status: MY_approved
  source_citations:
    - "MARDI Technical Bulletin No. 245 (2022)"
  confidence_score: 0.91
  last_updated: "2026-05-21"
```

---

## Quality Standard

Every entry passes two mandatory gates before it is published:

1. **Gate 1 — Schema Validation (CI):** Structural and field-level checks run automatically on every pull request. 100% must pass.
2. **Gate 2 — Professor Agent Review:** An AI agronomist agent modelled on MARDI's own review standards checks every entry for agronomic accuracy, safe dosages, and verifiable citations. Target: >85% PASS, confidence >0.80.

Entries that fail either gate are not merged.

---

## Contributing

We welcome contributions from agronomists, researchers, and data contributors.

1. Add a new YAML entry in `data/crops/{crop}/diseases/{disease}.yaml`
2. Follow the schema format shown above
3. Include at least one primary source citation (MARDI, DOA, FAO, or EPPO)
4. Submit a pull request — CI will validate your schema automatically
5. Professor Agent will review for agronomic accuracy

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Roadmap

- **Phase 1 (current):** 50+ validated entries across 8+ Malaysian crops
- **Phase 2:** MARDI and UPM collaboration; [Deep-X 2026](https://deepxgrant.my) grant application
- **Phase 3:** Hosted query API, extended to vegetables, aquaculture, and livestock

---

## License

**Data:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — free to use with attribution.
**Code:** [MIT](LICENSE).

---

## Citation

If you use AgriSchema-MY in research, please cite:

```
AgriSchema-MY (2026). Open-source Malaysian Crop Disease Knowledge Base.
https://github.com/agri-schema-my/agri-schema-my
```
