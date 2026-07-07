# Review Gate Design — Professor Agent v2

**Status:** Proposal · **Date:** 2026-07-07 · **Author:** review synthesis (3-lens AI panel)
**Component:** `pipeline/professor_agent.py` and the review phase of `run_pipeline.py`

---

## 1. Context

AgriSchema-MY publishes crop-disease treatment advice to Malaysian farmers. The
"professor agent" (`pipeline/professor_agent.py`) is the quality gate that approves
or rejects each YAML entry before it reaches the vector store and the `/query` API.

This document proposes **v2** of that gate. It keeps what the current rubric does
well and closes the structural gaps found in a three-lens adversarial review.

## 2. Current design (v1) — what it does

The reviewer is a single LLM (`claude-sonnet-4-6`) prompted as *Professor Ahmad
Fauzi*, a 25-year MARDI agronomist. It reads the entry YAML and emits JSON with a
verdict, `adjusted_confidence`, named `issues[]`, and `missing_treatments[]`.

Three verdicts, deliberately asymmetric:

| Verdict | Trigger |
|---|---|
| **PASS** | Agronomically sound, safe dosages, no fabricated citations. Minor doc gaps → notes only. |
| **FLAG** | A *specifically named* factual/safety concern to fix before publish. |
| **REJECT** | A *confirmed* critical error: dangerous dosage, dangerous compound, or a citation positively identified as fabricated. |

Rules worth keeping (`professor_agent.py:65-123`):
- Dosage errors are treated as CRITICAL (the failure mode that actually harms farmers).
- Honest "no curative treatment" answers are *credited*, not penalised — this trains against hallucination.
- A FLAG must NAME the specific concern (actionable, not "needs more detail").
- Vague citations are a WARNING, not grounds for REJECT.
- Null pre-harvest-interval (PHI): low-severity on non-food crops (rubber, oil palm), must-fix on food crops.

Operational hygiene worth keeping:
- 3 retries with backoff; on JSON parse failure it returns `None` and **refuses to cache**, avoiding a stale-FLAG bug (`professor_agent.py:213-218, 255-259`).
- Reviews cached to `data/reviews/**.review.json`; adjusted confidence written back to source YAML.

## 3. Why v1 is not yet a safety gate — three-lens review

An independent panel (regulatory, ML-evaluation, field-extension) reached a shared
conclusion: **v1 is a competent internal fact-checker but not a safety gate.** Its
most confident language ("positively identify a fabricated citation", "confirmed
dangerous dosage") describes verification it structurally cannot perform, because
it never opens the cited source.

**3.1 Regulatory / food-safety lens — UNSAFE as a gate.**
The rubric checks internal consistency but never Malaysian *legality*:
- No check that the compound is **registered** under the Pesticides Act 1974 / Lembaga Racun Makhluk Perosak for *that* crop-disease use. A well-cited dosage of an unregistered product PASSes — yet off-label use is itself illegal.
- No screening against a **banned/restricted/withdrawn** list. "Dangerous compound" is left to the model's memory; a delisted active (e.g. withdrawn organophosphates) can PASS and later trigger an export residue rejection.
- **PHI is checked for presence, not adequacy.** A populated-but-too-short PHI passes, which is exactly the failure mode that causes MRL exceedances.

**3.2 ML-evaluation lens — UNSOUND as a fact-checker.**
- **No ground truth.** The judge grades from its own parametric weights; it never retrieves the cited MARDI/DOA source. Numerically plausible but wrong dosages — the most dangerous class — pass *because* they are plausible.
- **Goodhart / metric-gaming.** The same author writes both the entries and the rubric, and a printed `target: >60%` PASS rate (`professor_agent.py:325`) is an outcome the rubric can be tuned to hit. The eval can optimise its own success metric instead of truth.
- **Single judge, one run, no calibration.** No ensemble, no repeat runs, and `adjusted_confidence` is written straight into the YAML as an authoritative `confidence_score` with zero calibration against measured correctness.

**3.3 Field-extension lens — NEEDS-WORK.**
The rubric grades the entry as a lab document, not an instruction a smallholder
executes. It omits what determines real-world outcome:
- **Availability & cost** at the local kedai tani, and a named **resistance-rotation** partner (different FRAC/IRAC group).
- **Application reality**: timing vs weather, spray interval, tank-mix, re-entry interval, and mixing/PPE safety.
- **IPM-first** framing and **plain Bahasa Malaysia** clarity (the `_slim_entry` step even truncates cultural controls to 3 to save tokens, `professor_agent.py:133-137`).

## 4. Proposed design (v2) — a 3-layer gate

Keep v1's good instincts; wrap them in the two things v1 lacks: **grounding** and
**an independent check**. Hard safety/legality becomes deterministic; the LLM only
ever grades *grounded* claims; no single judge is trusted.

```
  Entry (YAML)
      │
      ▼
┌─────────────────────────────────────────────┐
│ LAYER 1 · Deterministic compliance (code)   │
│  • registered for crop-disease?  ── no ─────►  REJECT
│  • on banned/restricted list?    ── yes ────►  REJECT
│  • PHI ≥ MRL clearance?          ── no ─────►  FLAG
│  • required field-practicality fields present│
│    (cost, rotation, timing/PPE, IPM, BM)  ──►  FLAG if missing
└───────────────┬─────────────────────────────┘
                │ passes hard gates
                ▼
┌─────────────────────────────────────────────┐
│ LAYER 2 · Retrieval-grounded LLM review      │
│  fetch cited MARDI/DOA passage               │
│  judge must QUOTE support per claim          │
│  ungrounded claim ──────────────────────────►  FLAG
└───────────────┬─────────────────────────────┘
                ▼
┌─────────────────────────────────────────────┐
│ LAYER 3 · Ensemble + calibration             │
│  ≥2 judges / N runs → disagreement ─────────►  FLAG
│  gold-set trap recall  (gates trust in judge)│
│  blind human 10% audit → calibrate conf.     │
└───────────────┬─────────────────────────────┘
                ▼
    PASS → confidence_score (calibrated) → embed → API → farmer
```

### Layer 1 — Deterministic compliance checks (code, not LLM)
Runs before any AI opinion. Deterministic, auditable, cheap.
- Compound registered for *this* crop-disease use → else hard **REJECT**.
- Compound on banned/restricted list → hard **REJECT**.
- Stated PHI clears the crop's MRL, not merely non-null → else **FLAG**.
- Required field-practicality fields present (see §5) → else **FLAG**.

Requires an authoritative reference list of Malaysian pesticide registrations /
banned actives / crop MRLs, stored in-repo (e.g. `data/reference/`) and versioned.

### Layer 2 — Retrieval-grounded LLM review
Fetch the cited MARDI/DOA passage and require the judge to **quote the supporting
text per claim**. Any claim it cannot ground defaults to **FLAG**, never PASS.
This converts the plausibility filter into an actual fact-checker. The v1 rubric
(dosage-first, honesty-credited, named-FLAG, asymmetric-REJECT) is retained as the
grading standard *on top of* grounding.

### Layer 3 — Ensemble + calibration
- **≥2 judges (or N runs)**; disagreement auto-downgrades to FLAG.
- **Held-out gold set with planted traps** (known-wrong dosages, fabricated
  citations, swapped scientific names) measures the judge's real catch-rate.
- **Kill the >60% PASS target as an objective** — report it descriptively only.
- **Blind human agronomist spot-audit** (~10% random sample) calibrates
  `adjusted_confidence` against measured accuracy before it is written back.

## 5. Schema changes

Promote field-practicality signals from "LLM's mood" to required fields, so their
absence is caught deterministically in Layer 1:

| Field | Purpose | Missing → |
|---|---|---|
| `registration_status` | registered / unregistered for crop-disease use | REJECT if unregistered |
| `regulatory_status` (exists) | MY_approved / restricted / banned | REJECT if banned |
| `pre_harvest_interval_days` (exists) | must clear MRL, not just non-null | FLAG if inadequate |
| `mrl_reference` | crop MRL the PHI must satisfy | FLAG |
| `cost_availability` | stocked/affordable at kedai tani | FLAG |
| `rotation_partner` | different FRAC/IRAC group for resistance mgmt | FLAG |
| `application` | timing, interval, re-entry, PPE | FLAG |
| `ipm_controls` | cultural/IPM options before chemical | FLAG |
| `instructions_bm` | plain-Bahasa-Malaysia farmer instruction | FLAG |

## 6. What is kept from v1

- The Professor Ahmad Fauzi grading standard and the three-verdict asymmetry.
- Dosage-as-critical; honesty ("no cure") credited; FLAG-must-be-named.
- PHI severity split (non-food WARNING vs food must-fix) — now backed by MRL logic.
- Retry/backoff and the no-cache-on-parse-failure rule.

## 7. Open questions / dependencies

1. **Source of truth for registration + banned list + MRLs.** Needs a maintained
   reference dataset (DOA/Lembaga Racun Makhluk Perosak, Codex/EU MRLs). Where
   does it come from, and how often is it refreshed?

   > **Finding (2026-07-07): PHI data is not publicly available for Malaysia.**
   > Two research passes confirmed no Malaysia-specific pre-harvest interval can be
   > sourced from the open web: the DOA / Lembaga Racun Makhluk Perosak registries
   > (`mypesticide.doa.gov.my`, `portal.doa.gov.my/racunberdaftar`) are login-gated
   > and do not expose per-product PHI, and Malaysia's Food Regulations 1985
   > (Sixteenth Schedule) publishes **MRLs** (residue limits, mg/kg), which are
   > legally distinct from PHIs (days-to-harvest). Best available evidence is
   > **foreign labels** (Australian APVMA, US EPA) — Tier C, not MY-authoritative.
   > Interim policy: foreign-label PHIs may be written with a `phi_source` citation
   > but MUST keep `phi_unverified: true` until validated against a real Malaysian
   > label. Never record regulatory data as authoritative without a MY source.
   > A logged-in `mypesticide.doa.gov.my` pull or physical DOA product labels are
   > the only paths to Tier-A PHI.
2. **Retrieval corpus for Layer 2.** MARDI/DOA PDFs are already scraped
   (`pipeline/scraper.py`); do we have clean passage-level text to quote from?
3. **Judge ensemble cost.** ≥2 models × N runs multiplies API spend — acceptable
   for a one-time publish gate, revisit if entries scale.
4. **Human audit capacity.** Layer 3 calibration needs a real agronomist for the
   10% sample. Who, and at what cadence?

## 8. Rollout

Incremental, lowest-risk-first:
1. **Layer 1** — deterministic checks + schema fields. No LLM change; immediate
   safety win against banned/unregistered compounds.
2. **Layer 2** — grounding, once passage-level source text is available.
3. **Layer 3** — ensemble + gold-set traps + human calibration, before any public
   HuggingFace release (supersedes the raw >60% PASS gate in `STRATEGY.md`).
