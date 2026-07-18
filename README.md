# AgriSchema-MY

**An honesty-first crop-disease knowledge base for Malaysian smallholder farmers** — sourced,
schema-validated disease and treatment data, plus a React web app that surfaces it, with every
food-safety claim honestly labelled as verified or unverified.

> Hackathon track: **AI for Social Impact / AgriTech.**

---

## Why it exists

A smallholder who sprays the wrong pesticide dose, or harvests before the pre-harvest interval
(PHI) has elapsed, puts residues on food and money at risk. Generic AI advice makes this worse:
it *sounds* authoritative while quietly hallucinating doses and withholding periods it cannot
actually back with a source.

AgriSchema-MY's answer is not "trust the AI." It is **show your working**:

- Every treatment carries a machine-checkable label saying whether its dose and PHI are backed
  by a real authority — or honestly admitting they are not.
- The farmer-facing text always routes the user back to the **registered product label** as the
  legal source of truth for the actual dose.
- A `verified: true` flag can only be set by code that checked a `doa.gov.my` source — never by
  an LLM. This is enforced by tests, not by good intentions.

---

## What's inside

- **23 disease entries** across **8 crops**, **46 treatments** total.

  | Crop | Entries | | Crop | Entries |
  |---|---|---|---|---|
  | paddy | 6 | | durian | 2 |
  | tomato | 4 | | oil_palm | 1 |
  | banana | 3 | | cocoa | 1 |
  | chilli | 3 | | **Total** | **23** |
  | rubber | 3 | | | |

- A **3-layer review gate** (deterministic compliance → professor agent → retrieval-grounded
  prototype) that entries pass before they are served.
- A **FastAPI** backend that serves the knowledge base as a query API.
- A **React + Vite** web app (`frontend/`) with a farmer flow (scan/search) and an admin flow
  (evidence search, review queue, analytics).

---

## The honesty model (read this first)

Two independent grounding blocks sit on **every** treatment. They are deliberately separate
because a dose and a withholding period come from different sources.

### `dosage_grounding` — **0 / 46 verified**

The authoritative Malaysian dose source, `mypesticide.doa.gov.my`, is login-gated, so **no dose
in this repo is DOA-verified today**. Every dose is an AI-generated agronomic estimate, and every
treatment says so:

```yaml
- compound: Tricyclazole
  trade_name: Beam 75WP
  dosage: 0.5g per litre water
  dosage_grounding:
    verified: false                      # never true — no public label-dose source exists yet
    note: AI-generated agronomic estimate, not the DOA-registered label dose ...
                                         # Verify the rate on the product label before spraying.
    doa_residue_reference: mymrl.doa.gov.my/AIs/121  # grounds the PHI, NOT the dose
```

### `phi_grounding` — **12 / 46 verified** (18 unverified, 16 not_applicable)

PHI is checked against the **public** residue portal `mymrl.doa.gov.my`. Only the 12 with a
`doa.gov.my` source are marked verified:

```yaml
  pre_harvest_interval_days: 30
  phi_grounding:
    verified: true                       # set by code, only because source is on doa.gov.my
    status: verified                     # one of: verified | unverified | not_applicable
    source: mymrl.doa.gov.my/AIs/121
```

### Anti-authority-washing invariants

`tests/test_grounding_invariant.py` (**6 tests, fully offline**) locks the honesty model so an LLM
can never earn a verification it doesn't deserve:

- a dose may be `verified: true` **only** with a registration-backed authoritative registry record
  (none exist → all doses stay `false`);
- a PHI may be `verified: true` **only** with a `doa.gov.my` source;
- `verified` and `status` must agree; the dose honesty label can never be silently dropped; and
- every entry's farmer-facing BM text must carry the "confirm the actual dose on the registered
  product label" caveat.

```
python tests/test_grounding_invariant.py   # → 6/6 passed
```

---

## Architecture & pipeline

Institution-facing pipeline builds and gates the data; farmer-facing app consumes it.

```
seed/extract → validate → compliance (L1) → review (L2 professor) → embed → API → Web app
                              │                                        │
                     deterministic gate                     grounded-review (L2 paddy prototype)
                     REJECT ⇒ fail-closed                    mymrl-fetch / doa-ingest (manual)
```

`python run_pipeline.py` phases:

| Flag | Phase | In `--all`? |
|---|---|---|
| `--scrape` | Download MARDI PDFs + extract text | no |
| `--seed` | Generate seed entries from Claude knowledge | yes |
| `--extract` | Claude extraction from raw PDF text | no |
| `--validate` | Schema validation | yes |
| `--compliance` | **Layer 1** deterministic compliance gate | yes |
| `--review` | Professor-agent review | yes |
| `--embed` | Ingest into ChromaDB vector store | yes |
| `--grounded-review` | **Layer 2** retrieval-grounded review (paddy prototype) | no |
| `--mymrl-fetch` | Crawl public `mymrl.doa.gov.my` residue portal → CSV | no |
| `--doa-ingest` | Ingest a DOA registration export (stays `draft`) | no |
| `--all` | seed + validate + compliance + review + embed | — |

**Fail-closed safety invariant:** any entry that a Layer-1 `REJECT` flags is **never embedded**
into the served vector store, and the run exits non-zero. Compliance is forced whenever `--embed`
(or `--all`) runs, so you cannot publish a rejected entry.

---

## Backend API

FastAPI app in `api/main.py`. All routes are read-only over the YAML knowledge base + ChromaDB.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Service metadata + endpoint list |
| `GET` | `/health` | Liveness (`{"status":"ok"}`) |
| `POST` | `/query` | Vector search by `crop` and/or `symptom` → ranked results |
| `GET` | `/crops` | List all crops |
| `GET` | `/crops/{crop}/diseases` | List diseases for a crop |
| `GET` | `/crops/{crop}/diseases/{disease_name}` | **Full entry YAML** (incl. grounding blocks) |
| `GET` | `/stats` | Entry counts, schema validity, professor verdict tallies |

Launch:

```bash
uvicorn api.main:app --port 8000        # add --reload for development
# Swagger UI → http://localhost:8000/docs   ·   ReDoc → /redoc
```

A `/query` result carries `disease_name, local_name, crop, confidence, professor_verdict,
symptoms_summary, treatments` (compound names), `citations`, and `relevance_score`. **Note:** the
`dosage_grounding`/`phi_grounding` honesty blocks are *not* flattened into the search response —
they live in the full entry, so fetch `GET /crops/{crop}/diseases/{disease_name}` to read them.

---

## Web app (GUI)

`frontend/` is a **React 19 + Vite + Tailwind** single-page app (deps: `react-router-dom`, `axios`,
`recharts`/`apexcharts`, `lucide-react`). It runs as its **own dev server** and talks to the API
over CORS — there is no static mount on the backend.

```bash
cd frontend
npm ci
npm run dev            # → http://localhost:5173
# API base URL defaults to http://localhost:8000; override with VITE_API_URL
```

**Farmer flow** (no login required): `Landing → Scan Crop` (upload a photo, pick crop / affected
part / duration) or `Search` (chat-style). Results render a **pathogen badge**, a **relevance
bar**, a **Malaysia-status badge** (`MY Approved / Restricted / Banned`, derived from the entry's
professor verdict), a citation list, and a fixed safety note telling the farmer to follow the
label rate, PPE and PHI — "AI-assisted screening only."

**Admin flow** (login): Dashboard, Evidence Search, Knowledge Base, Review Queue, Analytics.

**Honest status of the GUI:**

- Knowledge-base retrieval works through `POST /query` without an AI key. Grounded chatbot
  answers (`POST /ask`) and photo diagnosis (`POST /diagnose`) require the OpenAI or Gemini
  provider configured in `.env`.
- Login, signup, roles and marketplace state are client-side demonstration features. They are not
  production authentication or persistent server-side accounts.
- The search UI communicates honesty via the MY-status badge + the label-first safety note rather
  than per-dose/PHI verification badges. The granular `verified` flags are exposed through the
  full-entry endpoint, not the search results.

---

## Setup for judges

### Prerequisites

- Git
- Python 3.10–3.12
- Node.js 20.19+ or 22.12+
- Internet access for dependency installation and the first embedding-model download

AgriSchema-MY runs as two local processes: the FastAPI backend on port `8000` and the Vite
frontend on port `5173`.

### 1. Clone and configure the backend

```bash
git clone https://github.com/R3AlL3nGz3i/agri-schema-my.git
cd agri-schema-my

python3 -m venv .venv
source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt

cp .env.example .env
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

For the complete chatbot and photo-diagnosis demo, edit the repository-root `.env` and configure
one provider:

```dotenv
# Option A: Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here

# Option B: OpenAI
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_key_here
```

Do not commit real API keys. `ANTHROPIC_API_KEY` is only needed to regenerate or professor-review
knowledge entries; it is not required to serve the app. Basic `POST /query` knowledge-base search
also works without an AI key.

### 2. Build the vector store and start the API

Run these commands from the repository root with the virtual environment active:

```bash
python run_pipeline.py --embed
uvicorn api.main:app --port 8000
```

The first embed may take longer while ChromaDB downloads its default embedding model. Verify the
backend in another terminal:

```bash
curl http://localhost:8000/health    # expected: {"status":"ok"}
curl http://localhost:8000/stats     # knowledge-base statistics
```

Interactive API documentation is available at <http://localhost:8000/docs>.

### 3. Start the frontend

Open a second terminal:

```bash
cd agri-schema-my/frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. The frontend uses `http://localhost:8000` by default. To use a
different backend URL, copy `frontend/.env.example` to `frontend/.env` and change `VITE_API_URL`.

### 4. Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@agrischeme.my` | `admin123` |
| Researcher | `researcher@agrischeme.my` | `researcher123` |
| Seller | `seller@agrischeme.my` | `seller123` |

Farmers can continue as guests or create a local demonstration account. Demo authentication and
marketplace data are stored in the browser and are not production security or persistent
server-side storage.

### 5. Suggested judge check

Search for `rice blast disease in paddy` and confirm that the result displays its pathogen,
relevance, Malaysian status, citations and label-first pesticide safety note. With an AI provider
configured, judges can also test the grounded chat response and upload a crop photo for screening.

---

## Data layout & schema

```
data/crops/<crop>/diseases/<disease>.yaml     # 23 entries
data/reference/crop_disease_dose_index.csv    # flat 46-row crop/disease/dose index
data/reference/banned_compounds.yaml          # Layer-1 denylist
data/reference/crop_mrl.yaml                   # crop MRL / PHI reference
```

Top-level entry keys: `crop`, `disease{ ... }`, `professor_review{ verdict, date, reviewer }`.
Each `disease.treatments[]` item:

```
compound · trade_name · dosage · dosage_grounding{verified,note,doa_residue_reference}
method · frequency · pre_harvest_interval_days · phi_source
phi_grounding{verified,status,source} · regulatory_status
```

---

## Tests

All tests are standalone `__main__` runners (no pytest required):

```bash
python tests/test_grounding_invariant.py   # 6 anti-authority-washing invariants
python tests/test_compliance.py            # Layer-1 deterministic gate
python tests/test_pipeline_gate.py         # fail-closed embed/publish gate
python tests/test_grounded_review.py       # Layer-2 grounded review prototype
python tests/test_mymrl_fetcher.py         # mymrl.doa.gov.my crawler
python tests/test_doa_registry.py          # DOA registry ingest/audit
python tests/run_golden.py                 # golden-entry checks
```

---

## Sources & license

- **MARDI** — Malaysian Agricultural Research and Development Institute
- **DOA / Jabatan Pertanian Malaysia** — plant protection & pesticide regulator (`mymrl.doa.gov.my`
  public residue portal; `mypesticide.doa.gov.my` login-gated registry)
- **EPPO** — Global Database (pathogen taxonomy / phytosanitary)
- **FAO AGROVOC** — multilingual agricultural thesaurus

**Code:** MIT · **Data:** CC BY 4.0 (free to use with attribution).

Contributions welcome: add a YAML entry under `data/crops/<crop>/diseases/`, keep the
`dosage_grounding` / `phi_grounding` honesty blocks (the invariant tests will reject a
`verified: true` you can't back with a `doa.gov.my` source), cite a primary source, and open a PR.
