# AgriSchema-MY — Presentation Guide

**Last updated:** 2026-06-12 · All numbers below are real, verified against the repo on this date. Update them before each event.

---

## 1. The Project in One Breath

> **"AI assistants confidently invent crop treatment advice — wrong compound, wrong dose, sometimes chemicals that are banned in Malaysia. AgriSchema-MY is the verified grounding layer: the first open, structured, machine-readable crop disease knowledge base for Malaysian agriculture, where every entry carries a treatment protocol, its Malaysian regulatory status, and a citation back to a MARDI/DOA source."**

If you only get 15 seconds, say that.

## 2. Project Details (the facts you present)

### The problem
- Malaysia's crop disease knowledge lives in PDF bulletins (MARDI, DOA) — invisible to AI systems and apps
- LLMs asked about crop disease hallucinate: plausible-sounding dosages with no source, no awareness of what's `MY_banned`
- Existing resources don't fill the gap: CABI PlantwisePlus = 15K **prose** factsheets (not machine-readable); PlantVillage/Kaggle/HuggingFace = **image** datasets only. **Nobody** offers structured Malaysian disease + treatment + regulatory data. (Verified by competitive research, June 2026.)

### The solution — what's actually built
- **Dataset:** 23 schema-valid YAML entries across 9 crops (paddy, chilli, tomato, banana, durian, rubber, oil palm, cocoa + sayuran placeholder). Each entry: pathogen ID, symptom profile with severity stages, dosed treatment protocols, `MY_approved/restricted/banned` status, MARDI/DOA citations, confidence score
- **Pipeline (the technical story):** multi-agent system — seed generator (Claude) → schema validator (CI on every PR) → **Professor Agent** (AI agronomist reviewer, Anthropic SDK, PASS/FLAG/REJECT verdicts with per-field issues) → vector embedder (ChromaDB)
- **API:** FastAPI — `/query` (semantic search over symptoms, English + Bahasa Melayu), `/crops`, `/stats`, `/health`
- **Eval:** golden-query suite — currently **7/9 retrieval hit-rate (78%)**, including a Bahasa Melayu query and a pre-harvest-interval safety query

### Numbers you can defend on stage (as of 2026-06-12)
| Metric | Value | If asked... |
|---|---|---|
| Entries | 23 schema-valid, across 9 crops | "Validated quality over scale — every entry passes CI" |
| Indexed for search | 21 | "2 are excluded because our own reviewer REJECTED them — the gate is real" |
| Retrieval eval | 7/9 golden queries (78%) | "Both misses are explained: one disease isn't in the dataset yet, one is excluded by review — by design" |
| Professor review | 6 PASS / 17 FLAG | **Lead with honesty:** "17 flags, and almost all are the same gap — missing pre-harvest intervals. The reviewer caught it; that's the system working. We're filling them from label data" |
| Languages | English + Bahasa Melayu queries work | Demo Q03 live if challenged |

**The honesty rule:** never inflate these. A judge who catches one inflated number discounts everything else. "Our quality gate flags our own data and we publish the flags" is a *stronger* story than fake 100% pass rates.

## 3. How to Present — 3-Minute Demo Script

| Time | Beat | What you do / say |
|---|---|---|
| 0:00–0:20 | **Hook** | Ask a vanilla LLM (live or screenshot): *"My chilli fruits have sunken dark spots, what do I spray and how much?"* → it answers fluently, no source, no regulatory check. "Would you spray your food crop based on this?" |
| 0:20–0:50 | **Problem** | "Malaysia: 440K+ smallholders. Wrong treatment = lost harvest. Banned chemical = rejected export. The real knowledge exists — locked in government PDFs no AI can read." |
| 0:50–1:50 | **Demo** | Same question into AgriSchema-MY UI/API: grounded answer — anthracnose (*Colletotrichum scovillei*), mancozeb 2.5g/L, **MY_approved badge**, 7-day pre-harvest interval, citation to MARDI bulletin. Side-by-side with the LLM answer. Then one Bahasa Melayu query to show bilingual retrieval |
| 1:50–2:20 | **How it works** | One architecture slide: PDF/seed sources → Claude extraction → schema CI → **AI Professor reviews every entry and publishes its verdicts** → vector search → grounded API. "The pipeline is itself multi-agent — agents generating, agents auditing" |
| 2:20–2:45 | **Why it's defensible** | "CABI is prose. PlantVillage is images. Nobody else has structured Malaysian treatment + regulatory data. Open data (CC BY 4.0), open code (MIT)" |
| 2:45–3:00 | **Ask / vision** | "Every tropical country has the same locked-PDF problem. This is the template. Dataset on HuggingFace, API is live — build on it" |

**Demo insurance:** record a backup screen capture of the working demo the night before. If wifi/API dies, narrate over the recording without apologizing.

## 4. 10-Slide Pitch Outline

1. **Title** — AgriSchema-MY: the verified grounding layer for tropical agriculture (logo + one-liner)
2. **Problem** — AI hallucinate treatment advice; Malaysian agri knowledge is locked in PDFs (show a real hallucinated answer)
3. **Stakes** — smallholder livelihoods, food safety, export compliance (`MY_banned` exists for a reason)
4. **Solution** — structured, validated, citable knowledge base + grounded diagnosis API (the side-by-side screenshot)
5. **Demo** — (live; this slide is just a fallback screenshot)
6. **How** — pipeline architecture: extract → validate → AI professor review → embed → serve
7. **Quality gate** — the PASS/FLAG system, published verdicts, eval numbers ("we audit ourselves and show you the audit")
8. **Why us / why now** — competitive gap table (CABI/PlantVillage/Plantix vs. us); solo dev + AI agents = this took weeks, not years
9. **Roadmap** — 50+ entries, photo diagnosis, human agronomist validation, regional expansion (ID/TH/VN template)
10. **Ask** — try the API, star the repo, dataset on HuggingFace; (event-specific: prize/partnership/users)

## 5. Event-Specific Angles

- **NASA Space Apps (Oct, main target):** lead with open data + earth observation: NASA soil moisture/NDVI + disease KB = disease *risk* layer, not just lookup. Frame: "open data in (NASA), open data out (CC BY 4.0)"
- **lablab.ai agent hackathons (July bridge):** lead with the **pipeline as a multi-agent showcase** — generator agent, validator, professor-reviewer agent, the audit trail. The dataset is the *output* of the agents
- **Job interviews / portfolio:** lead with engineering judgment — "I built an eval before scaling", "my quality gate rejected my own data and I shipped the audit trail", "SDK over subprocess after diagnosing silent CLI failures". Link the technical write-up

## 6. Q&A — the five questions you WILL get

1. **"Is the data correct? You're not an agronomist."** → "Right — which is why every entry cites a MARDI/DOA source, an AI reviewer audits every field and we publish its verdicts, and the next step is human agronomist spot-checks. We never generate advice — we retrieve cited official guidance."
2. **"Liability if a farmer follows it and loses a crop?"** → "We retrieve and cite official guidance verbatim with its regulatory status — we don't invent recommendations. The UI carries a verify-with-DOA disclaimer. Compare the baseline: an LLM with no source at all."
3. **"Why so few entries?"** → "Deliberate. 23 entries with citations, validation, and a published audit beat 5,000 scraped rows nobody checked. The pipeline scales — quality was the hard part."
4. **"What about MARDI copyright?"** → "Facts aren't copyrightable; we restate facts with citation, never copy prose, and we're seeking MARDI collaboration — this surfaces their work to a new audience."
5. **"Couldn't Google/OpenAI just do this?"** → "They won't — Malaysia-specific regulatory agri data is too narrow for them and exactly right for an open dataset. If they ground on our data, that's the mission succeeding."

## 7. Presentation Hygiene

- Practice the 3-minute run **out loud, timed, 5×** — hackathon judges cut you off at the buzzer
- One person, one laptop, demo pre-loaded, API pre-warmed (first embed-model load is slow — hit the endpoint once before going up)
- Slides: big text, one idea per slide, no paragraph slides; the side-by-side screenshot is your money shot
- End every conversation (judges, hallway) with the one-liner from Section 1
