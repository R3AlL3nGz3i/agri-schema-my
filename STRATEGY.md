# AgriSchema-MY — Hackathon-First Strategy

**Date:** 2026-06-12 (Rev 2 — post red-team) · **Produced by:** CEO synthesis over a 5-agent strategy council (VC direction, hackathon strategy, CTO audit, hackathon landscape research, competitive research), then challenged by a 2-agent red team (challenger CEO + execution skeptic). Rev 2 changes: FAO GAC dropped from critical path; eval benchmark + technical write-up promoted to first-class deliverables; professor gate must reach >60% PASS before any public publish; build order corrected after repo verification; lablab.ai July entry added as momentum bridge.

---

## 1. Direction — The Thesis

> **LLMs confidently invent crop treatment advice. AgriSchema-MY is the verified grounding layer for tropical agriculture — the only structured, citable, regulation-aware crop disease knowledge base for Malaysia.**

**The wedge is NOT the raw dataset** (judges and customers can't feel a YAML file). The wedge is the **grounded diagnosis demo**: symptom/photo in → cited diagnosis + officially-approved treatment + `MY_approved` badge out, shown side-by-side against a vanilla LLM answer with no source. The dataset is the moat; the diagnose API is the product; the side-by-side is the pitch.

This wins because the competitive gap is real (verified 2026-06-12):
- [CABI PlantwisePlus](https://plantwiseplusknowledgebank.org/about) — 15,000+ items but **prose factsheets**, not machine-readable, global not MY-specific
- PlantVillage / Kaggle / [HuggingFace agri datasets](https://huggingface.co/datasets/Saon110/bd-crop-vegetable-plant-disease-dataset) — **image classification** datasets, no treatment/regulatory layer
- **Nobody** offers structured Malaysian disease + treatment + regulatory-status data. Search confirms no MARDI machine-readable open dataset exists.

## 2. Who It Benefits (ranked)

| Rank | Segment | Pain | Realistic? |
|---|---|---|---|
| 1 | **AI/agritech developers** (SEA) | Can't build advisory tools without hallucination risk; no grounding data exists | ✅ Primary — they consume via HF/GitHub/API |
| 2 | **Agronomists / extension officers** | Advice scattered across PDF bulletins | ✅ Secondary — credibility validators, hackathon judges love them |
| 3 | **Smallholder farmers** | Misdiagnosis + wrong/banned chemical use | ⚠️ End beneficiary in the *narrative*, but reached only through #1/#2's products — do not build farmer UX yet |
| 4 | Government / MARDI | Their knowledge is locked in PDFs | ⚠️ Partnership/grant target (Deep-X 2027), not a customer |
| 5 | Crop insurers / input suppliers | Risk models, compliance | ❌ Fantasy at this stage — ignore until post-traction |

**Hackathon framing:** "440,000 Malaysian smallholders; wrong treatment = lost harvest; banned-chemical use = rejected exports. AI could help but hallucinates dosages. We fixed the data layer."

## 3. Output Definition (what we ship)

**Demo artifact (the hackathon deliverable):**
1. **Dataset v1.0** — target 35–40 validated YAML entries (current verified state: 29 files, 23 schema-pass; 6 junk slated for deletion in T1), 100% schema-pass, professor-reviewed, published on HuggingFace Datasets + GitHub release (CC BY 4.0)
2. **`/diagnose` API** — symptom text (BM or English) → Chroma top-3 → Claude ranks/explains → diagnosis card with treatment, regulatory badge, MARDI citation, confidence score
3. **Photo diagnosis** — image → Claude vision → symptom description → same pipeline
4. **Single-page demo UI** — served by FastAPI; left panel: AgriSchema grounded answer with citation + `MY_approved` badge; right panel: ungrounded LLM answer. The contrast IS the demo.
5. **Eval benchmark (headline artifact)** — 30-question eval: vanilla LLM vs. AgriSchema-grounded API, measuring citation accuracy + treatment correctness. Published in README + HF card. *"We measured X% fewer hallucinations" beats "we think it helps" — this number is more hireable than the demo UI.*
6. **Technical write-up** — ~1,000 words on dev.to/Medium ("How I built a multi-agent RAG grounding system for Malaysian agriculture"), published right after Week 2. This is what a hiring manager actually reads after seeing the GitHub link.
7. **3-min video + 10-slide deck** (reusable across every event)

**Publish gate:** the HuggingFace dataset does NOT go public until the professor gate reaches **>60% PASS**. A quality gate that flags 100% of entries is a liability, not a feature. Once most entries pass, the open FLAG audit trail becomes the transparency story.

**Safety stance (also the pitch):** the system never generates treatment advice — it *retrieves* official MARDI guidance verbatim with citation, displays regulatory status, and carries a "verify with your local DOA office" disclaimer. Anti-hallucination is the product.

## 4. Distribution Channels (ranked by effort-to-reach)

**Hackathon phase:** ① HuggingFace Datasets (AI devs find it organically) ② GitHub + README badges ③ hackathon submissions themselves (Devpost/lablab profiles are distribution) ④ a launch post (X/LinkedIn + r/MachineLearning + HN "Show HN").
**Post-hackathon:** ⑤ hosted API w/ free tier ⑥ Telegram bot pilot (agronomist groups, not farmers) ⑦ MARDI/UPM partnership via Deep-X 2027 ⑧ agri-input retailer networks (later, with a partner).

## 5. Target Hackathons (from live research, 2026-06-12)

| Priority | Event | Deadline | Action |
|---|---|---|---|
| 🟠 Main target | [NASA Space Apps Challenge](https://www.spaceappschallenge.org/) — Oct 2026, KL has hosted before | Register mid-2026 | The big build target. Bolt NASA open data (soil moisture, NDVI) onto disease-risk layer. Solo-friendly, global badge = CV gold |
| 🟡 **July bridge** | [lablab.ai rolling AI hackathons](https://lablab.ai/ai-hackathons) — ~monthly | **Commit to one July event** | Red-team call: October is too far to anchor momentum. Enter a July agent-themed event with the extraction→validation→professor-review pipeline as the multi-agent showcase. Forces a ship moment + Devpost profile entry |
| ⚪ Optional | [FAO Global AgriInno Challenge 2026](https://opportunitydesk.org/2026/05/29/un-fao-global-agriinno-challenge-2026/) — up to $30K | 20 June 2026 | **Dropped from critical path by red team:** SIDS theme is a forced fit for Malaysia (not a SIDS, no SIDS partner), finals require Hangzhou travel in Aug, and the hours serve the job-hunt goal less than building. Apply only if you personally want to spend ~2h on the form — do not trade build time for it |
| ⚪ Conditional | [Build with Gemini XPRIZE](https://xprize.devpost.com/) — $2M pool | 17 Aug 2026 | Only if willing to wire Gemini + get real users by Aug. Skip unless GAC/momentum makes users easy |
| 📅 2027 calendar | Deep-X 2027 (apps ~Mar–May) · Project 2030 MyAI w/ Agrotech track (~Mar–May) · AI for Good Space Computing (reg opens 1 Dec 2026) | — | Set reminders; both were the best-fit MY events but closed for 2026 |

## 6. Build Roadmap (2-week solo sprint — Rev 2, repo-verified order)

Red-team corrections applied: embed must precede eval AND smoke test (empty Chroma = empty results); `/diagnose` is a **net-new build**, not a patch (no such endpoint exists in `api/main.py`); first embed run downloads ~90MB sentence-transformers model — warm it up before any demo. Realistic Week 1 total: **12–14h**, not 8.

**Week 1 — make it real:**
- **T1: Data hygiene** *(1.5h)* — **verified by orchestrator:** all 5 `chili/` entries are null-field extractor junk failing schema validation (keep rich `chilli/`; the red-team's "merge by count" suggestion was wrong). Delete `chili/` AND `taro/leaf_blight.yaml` (also fails validation); record `bacterial_spot`, `black_sooty_mould`, `cercospora_leaf_spot` (chilli) + `leaf_blight` (taro) as proper seed targets. Delete the 2 poisoned review caches (`paddy/rice_blast.review.json`, `tomato/late_blight.review.json`) so professor retries them. Target state: validator passes 23/23.
- **T2: API path fix** *(0.5h)* — `api/main.py` uses cwd-relative `Path("data")` (lines ~110/121/141/153) → anchor to `Path(__file__).parent.parent / "data"`.
- **T3: Build Chroma index** *(1h incl. model download)* — `run_pipeline.py --embed`; verify `data/chroma/` non-empty.
- **T4: Golden-query eval** *(1h)* — run the 10 `tests/golden_queries.json`; fix known issues: Q06 lacks `expected_disease`, Q09 expects `sayuran` which has no entries.
- **T5: API smoke test** *(0.5h)* — uvicorn from repo root + curl `/crops` `/stats` `/query`.
- **T6: Professor rubric fix** *(2h)* — red-team requirement moved INTO Week 1: recalibrate the rubric (current state: 0% PASS, 13 FLAG), re-run on all entries. Publish gate: >60% PASS.
- **T7: `/diagnose` endpoint** *(2.5–3h, net-new)* — Chroma top-3 → load full YAML → Anthropic **SDK** call (never `claude -p` subprocess — silent exit-1s + 180s hangs kill live demos) → structured response with confidence, citation, regulatory badge. Include error handling + fallback response — a demo that silently 500s is worse than no demo.

**Week 2 — make it demo-able (~12h):**
- **T8: Photo diagnosis** *(3–4h)* — image → Claude vision → symptom text → reuse `/diagnose`.
- **T9: Single-page frontend** *(3–4h)* — vanilla JS/Alpine, no build step: crop dropdown, symptom box, photo upload, result cards (confidence + citation + regulatory badge) + side-by-side ungrounded-LLM panel.
- **T10: Eval benchmark** *(2–3h)* — the 30-question vanilla-vs-grounded comparison; numbers into README + HF card.
- **T11: Seed 10–15 more entries** *(1–2h)* — durian/banana/papaya timed-out targets + the 4 re-seed targets from T1; professor-review everything new.
- **T12: Publish** — HuggingFace dataset (only if >60% PASS) + 3-min video + deck + **technical write-up on dev.to/Medium** + LinkedIn milestone post.

**Do NOT build:** PDF-extraction improvements (seeding is the data source — extraction yielded 6 junk entries from ~70 calls), auth, a database, AGROVOC integration, multi-language UI, mobile app, deployment infra beyond one Fly.io/Railway container.

## 7. Research Plan (dataset growth + validation)

1. **Seed-first, extract-later:** the seed generator (Claude + curated targets) produced all 23 good entries; PDF extraction produced junk. Add retry/backoff to `claude_cli` calls, fix the professor cache to not store parse-failures, then scale seeding to 50+ entries across the 13 target crops.
2. **Fix the regulatory bias:** the seed prompt hard-codes `MY_approved` in examples — rewrite so status must be justified per compound (this is the dataset's most defensible field; it must be right).
3. **Validation ladder:** schema CI (gate 1) → professor agent (gate 2) → *human agronomist spot-check* (gate 3, post-hackathon: recruit 1 UPM grad student/forum agronomist to review 10 entries — instant credibility line for the pitch).
4. **Eval harness:** grow `golden_queries.json` from 10 → 30; track retrieval hit-rate per release.

## 8. Commercialization Path (post-hackathon sequence)

1. **Now → Oct 2026:** Open everything. Win badges (GAC, Space Apps, lablab). These are credibility assets — for the project *and the job hunt*.
2. **Dec 2026 – Mar 2027:** Grants, not revenue — Deep-X 2027, MDEC, AI for Good. Use hackathon wins as traction evidence.
3. **2027:** Open-core — dataset stays CC BY 4.0 forever; monetize the **hosted API** (free tier → metered) and **B2B data licensing** (agritech apps, insurers needing the regulatory layer).
4. **Venture-fundable only if:** API gets real B2B usage + expansion beyond MY (Indonesia/Thailand/Vietnam = same model, 10x market). Until then this is a grant-funded open-data project — that's fine.

## 9. Top Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Liability for treatment guidance** (someone follows a wrong dosage) | Retrieve-don't-generate design; verbatim official guidance + citation; prominent disclaimer; never ship entries that fail professor review |
| **MARDI content copyright** (bulletins aren't explicitly open-licensed) | Facts aren't copyrightable but text is — entries restate facts with citation, never copy prose; proactively email MARDI about partnership (turns risk into ally; helps Deep-X 2027) |
| **Professor gate currently passes 0%** (13 FLAG / 1 REJECT / 0 PASS) — pitch claims ">85% PASS" | **Hard gate (red-team ruling):** fix the rubric in Week 1 (T6) and do NOT publish the HF dataset until >60% of entries PASS. Only then frame the open FLAG audit trail as a transparency feature. "Honestly re-frame" alone is not acceptable — a gate that fails everything is a liability |

## 10. Immediate Next Actions (this week, by Sun 15 June)

1. ✅ T1–T2: Data hygiene + API path fix — *2h*
2. ✅ T3–T5: Embed → golden-query eval → API smoke test (in that order) — *2.5h*
3. 🔴 T6: Professor rubric fix + re-run — the publish gate depends on it — *2h*
4. 🤝 **Recruit one human agronomist validator** (replaces FAO GAC per red team): email UPM crop protection dept + post in Malaysian agri Facebook groups asking for a 10-entry spot-check. One expert endorsement beats one long-shot grant application
5. 📅 Calendar: lablab.ai July event (commit to one — momentum bridge), NASA Space Apps registration (check monthly from July), Deep-X 2027 (~Mar), Project 2030 MyAI 2027 (~Mar), AI for Good Space Computing (1 Dec 2026). FAO GAC (20 Jun) only if user personally opts in
6. 💼 LinkedIn cadence: 3-sentence post per shipped milestone (HF publish, first eval number, agronomist endorsement) — free recruiter visibility
