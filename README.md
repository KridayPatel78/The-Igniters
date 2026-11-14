# The Igniters — Flame in Freefall

NASA Space Apps Challenge 2026 · Kamloops (TRU)

An AI-powered dashboard that summarizes, ranks and interprets NASA's microgravity combustion
investigations to deliver fire-safety insights for crewed habitats (spacecraft, stations,
Moon/Mars bases, pressurized rovers).

**NASA data used:** all 10 resources from the challenge page. The core dataset is the
[PSI Data Repository — Combustion Science](https://psi.nasa.gov/physci/repo/search?q=combustion)
(Physical Sciences Informatics), with every investigation cited by its DOI. The other nine
(NASA Combustion Science, the ISS Combustion Researcher's Guide, ScienceCasts video, Apollo 1,
Apollo 13, Mir fire, and three NASA spinoffs) feed the AI librarian and the "Why this matters"
and "Earth spin-offs" panels. Full table: [AGENTS.md](AGENTS.md#all-10-challenge-resources-and-where-each-one-is-used)
· machine-readable list: [`rag/sources.json`](rag/sources.json).

Project brief, data contract and scoring rubric: **[AGENTS.md](AGENTS.md)** (read this first —
it is also what our coding agents read).

## Setup (each teammate)

```bash
git clone https://github.com/KridayPatel78/The-Igniters.git
cd The-Igniters
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env  — then add GEMINI_API_KEY
pytest -q                          # data-contract check should pass
streamlit run app/main.py          # shows the sample data
```

## Workflow

| Person | Branch | Folder(s) |
|---|---|---|
| 1 · Data | `data` | `ingest/` |
| 2 · Extraction + scoring | `extract` | `extract/`, `rank/` |
| 3 · AI | `rag` | `rag/` |
| 4 · Frontend + pitch | `app` | `app/` |

- `git pull` before every new agent task; merge to `main` every ~2 hours (lunch, dinner).
- Stay in your own folder. The **Data contract** in AGENTS.md is the only shared interface —
  change it only if the whole team agrees, and update AGENTS.md first.
- Build against `data/processed/investigations.sample.json` until the real
  `investigations.json` lands. `pytest` checks both files against the contract.
- Never commit `.env`. `data/raw/` **is** committed (a fixed PSI snapshot everyone shares) —
  don't re-fetch it or edit it by hand.

## Data pipeline

```bash
python -m ingest.fetch_psi             # already done: PSI JSON + experimental-table CSVs -> data/raw/
python -m extract.normalize            # data/raw/ -> data/processed/investigations.json
python -m extract.normalize --no-llm   # same, without Gemini (LLM fields -> "not reported")
```

| Path | What it is |
|---|---|
| `data/raw/<PSI-ID>.json` | Investigation metadata exactly as PSI returned it (24 files) |
| `data/raw/<PSI-ID>/*.csv` | Experimental tables (22 CSVs for 20 IDs; PSI-60, 62, 115, 117 have none) |
| `data/raw/_manifest.json` | Per ID: acronym, title, DOI, which tables were saved, any errors |
| `data/processed/investigations.json` | The 24 records in the Data contract shape — what `rank/`, `rag/` and `app/` read |
| `data/processed/provenance.json` | Where every value came from (CSV column, JSON field, rule, override, or LLM + verbatim quote) |
| `data/interim/llm/<PSI-ID>.json` | Cached Gemini output (reused; refresh with `--refresh-llm`) |
| `extract/REVIEW.md` | Human checklist: every field + its source, unclear columns, rejected LLM values |
| `extract/overrides/<PSI-ID>.json` | Human corrections; beat everything else (see `extract/overrides/README.md`) |
| `extract/checked_ids.txt` | IDs a person verified against the PSI page → `extraction_confidence: "checked"` |

Numbers (O2 %, pressure in psi, airflow in cm/s) come only from experimental-table CSV columns;
if a column or unit is unclear the value is `null` and listed in `extract/REVIEW.md`.
The LLM fills only text-derived fields and must quote the PSI text it used; unverified values
are dropped.

## Antigravity setup

1. Welcome screen → **Clone Repository** → this repo.
2. Agent policy: **Review-driven development** (approve plans, diffs and commands).
3. Use **Planning** mode for anything bigger than a small fix; **Fast** for small edits.
4. Check **… → Customizations → Rules**: `AGENTS.md` should be listed.

## First agent prompts

**Person 1 · Data** (branch `data`)
> Read AGENTS.md. Write ingest/fetch_psi.py that reads ingest/psi_ids.txt (skip blank and #
> lines; the ID is the first token), fetches each investigation's JSON from the endpoint in
> AGENTS.md sequentially with a 1-second delay, and saves it to data/raw/<id>.json. Then, for
> each entry in the JSON's experimentalTable, download the CSV using the two-step PSI download
> endpoint described in AGENTS.md (NOT the direct S3 link, which returns 403) and save it to
> data/raw/<id>/<file_name>. Skip anything already cached. Never download Raw Data files.
> Never log the signed URLs. Print a summary: IDs fetched, IDs with tables, IDs without.

`ingest/psi_ids.txt` already lists all 24 Combustion Science investigations (verified).

**Person 2 · Extraction + scoring** (branch `extract`)
> Read AGENTS.md. Write rank/score.py implementing the Scoring rubric as pure functions over
> records matching the Data contract, returning total score plus a per-criterion breakdown,
> for each scenario preset. Write tests/test_score.py covering every criterion and null
> values. Then write extract/normalize.py that turns data/raw/*.json into
> data/processed/investigations.json: copy fields directly where they exist, and use the
> Gemini API only for fields that must be inferred from text, setting
> extraction_confidence to "llm_unchecked" for those records.

**Person 3 · AI** (branch `rag`)
> Read AGENTS.md, especially "All 10 challenge resources". Write rag/fetch_resources.py that
> reads rag/sources.json and, for every entry of type "text", fetches the page once and saves
> cleaned main-body text to data/raw/resources/<id>.txt (skip if cached; 1-second delay; if a
> fetch fails, print the URL so we can save it by hand). Write rag/build_index.py that chunks
> (a) objective, approach, hypothesis, researchImpacts and description from data/raw/*.json
> (fall back to the sample file) and (b) every data/raw/resources/*.txt, embeds with
> sentence-transformers, and stores in Chroma with metadata: source_type ("psi" or
> "resource"), psi_id + doi for PSI chunks, title + url for resource chunks. Write
> rag/ask.py with answer(question) that retrieves top chunks and asks Gemini to answer ONLY
> from them, citing [PSI-ID, DOI] or [title, URL] for every claim, never taking experiment
> numbers from non-PSI sources, and saying "not covered by our NASA sources" when the chunks
> don't support an answer.

**Person 4 · Frontend + pitch** (branch `app`)
> Read AGENTS.md. Build the Streamlit app in app/ against
> data/processed/investigations.sample.json: sidebar scenario picker (presets from the
> rubric) and pillar focus; main view of ranked cards showing score breakdown, O2, pressure,
> airflow, fuel phase, DOI link; a Compare tab with a side-by-side table for 2–4 selected
> investigations; a Known gaps tab; an Ask tab with a placeholder that will call rag.ask;
> a "Why this matters" tab (Apollo 1, Apollo 13, Mir fire) and an "Earth spin-offs" tab
> (air tanks, fire detector, fire attire), each a short card linking its URL from
> rag/sources.json; and a "Data sources" section listing all 10 resources with links,
> including the ScienceCasts video. Import scoring from rank/score.py once it exists;
> until then use a stub.

## Before submission (Sunday)

- [ ] Make this repo **public** (required for global judging)
- [ ] Local pitch + submission by 16:00 · global submission by 23:59
- [ ] Demo: video ≤ 30 s with English subtitles, or ≤ 7 slides incl. title
- [ ] Project page lists all 10 NASA resources used (see AGENTS.md table)
