# The Igniters — Flame in Freefall

NASA Space Apps Challenge 2026 · Kamloops (TRU)

**Live site: [the-igniters-web-ochre.vercel.app](https://the-igniters-web-ochre.vercel.app)**

An AI-powered dashboard that summarizes, ranks and interprets NASA's microgravity combustion
investigations to deliver fire-safety insights for crewed habitats (spacecraft, space stations,
Moon bases, pressurized rovers and spacesuits).

**Team:** Kriday Patel, Khushmeet Kaur Bade, Abhay Verma and Narshini Chuckowry.

## NASA data used

All 10 resources from the challenge page. The core dataset is the
[PSI Data Repository — Combustion Science](https://psi.nasa.gov/physci/repo/search?q=combustion)
(Physical Sciences Informatics, CC0), with every investigation cited by its DOI. PSI is the only
source of experiment numbers; the other nine are text and video used by the AI (IgniterX) and the
"Why it matters" and "Earth spin-offs" sections.

| # | Resource | Used in |
|---|---|---|
| 1 | [PSI Data Repository: Combustion Science](https://psi.nasa.gov/physci/repo/search?q=combustion) | Scores, rankings, Data Explorer, Compare, IgniterX |
| 2 | [NASA Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/) | IgniterX search index |
| 3 | [A Researcher's Guide to ISS Combustion Science](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/) | IgniterX search index |
| 4 | [NASA ScienceCasts: The Power of Studying Combustion on the ISS](https://www.youtube.com/watch?v=W1oXykoz9zg) | Method & sources page |
| 5 | [Apollo 1](https://sma.nasa.gov/sma-disciplines/accllp/apollo-1) | Why it matters, IgniterX |
| 6 | [Apollo 13](https://sma.nasa.gov/sma-disciplines/accllp/apollo-13) | Why it matters, IgniterX |
| 7 | [25 Years Ago: Fire Aboard Space Station Mir](https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/) | Why it matters, IgniterX |
| 8 | [Fireman's Air Tanks](https://spinoff.nasa.gov/node/9582) | Earth spin-offs |
| 9 | [Fire Detector](https://spinoff.nasa.gov/node/9407) | Earth spin-offs |
| 10 | [New Technology for the Fire Attire](https://spinoff.nasa.gov/node/9918) | Earth spin-offs |

Machine-readable list: [`rag/sources.json`](rag/sources.json). Scoring rubric and exact
formulas: [`rank/README.md`](rank/README.md).

## Setup

```bash
git clone https://github.com/KridayPatel78/The-Igniters.git
cd The-Igniters
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pytest -q                          # all checks should pass
```

Only re-running the AI steps needs a Gemini key: create a file named `.env` in the repo root
containing `GEMINI_API_KEY=your-key`. Never commit it.

Python is the offline **data factory** (download → organize → score → index → export JSON).
The **website** is a Next.js app in `web/` deployed on Vercel. It reads only `web/data/`, and
setup lives in [web/README.md](web/README.md).

## Data pipeline

```bash
python -m ingest.fetch_psi             # already done: PSI JSON + experimental-table CSVs -> data/raw/
python -m extract.normalize            # data/raw/ -> data/processed/investigations.json
python -m extract.normalize --no-llm   # same, without Gemini (LLM fields -> "not reported")
python -m rank.score --scenario moon_base --focus all   # transparent 0-100 ranking (rank/README.md)
python -m rag.fetch_resources          # already done: 8 NASA text resources -> data/raw/resources/
python -m rag.build_index              # chunks + Gemini embeddings -> data/processed/rag_index.json
python -m rag.ask "How was smoke detection tested on the ISS?"   # cited answer (rag/README.md)
python -m rag.ask --demo               # demo answers + rag_eval.json parity fixture
python -m scripts.export_web           # everything the website reads -> web/data/
```

Gemini calls are cached and committed under `data/interim/` (llm, embeddings, explanations,
summaries), so re-running the pipeline costs nothing unless the inputs change.

| Path | What it is |
|---|---|
| `data/raw/<PSI-ID>.json` | Investigation metadata exactly as PSI returned it (24 files) |
| `data/raw/<PSI-ID>/*.csv` | Experimental tables (22 CSVs for 20 IDs; PSI-60, 62, 115, 117 have none) |
| `data/raw/_manifest.json` | Per ID: acronym, title, DOI, which tables were saved, any errors |
| `data/processed/investigations.json` | The 24 cleaned records that `rank/`, `rag/` and the website read |
| `data/processed/provenance.json` | Where every value came from (CSV column, JSON field, rule, override, or LLM + verbatim quote) |
| `data/interim/llm/<PSI-ID>.json` | Cached Gemini output (reused; refresh with `--refresh-llm`) |
| `extract/REVIEW.md` | Human checklist: every field + its source, unclear columns, rejected LLM values |
| `extract/overrides/<PSI-ID>.json` | Human corrections; beat everything else (see `extract/overrides/README.md`) |
| `extract/checked_ids.txt` | IDs a person verified against the PSI page → `extraction_confidence: "checked"` |
| `data/processed/rag_index.json` | IgniterX search index: 378 chunks + Gemini vectors (768 dims, base64 float32) |
| `data/processed/rag_eval.json` | Parity fixture: query vectors + expected chunk IDs for the 8 demo questions |
| `web/data/` | Website input written by `scripts/export_web.py` (24 rankings, explanations, index, sources, meta) |

## Data rules

- Numbers (O₂ %, pressure in psi, airflow in cm/s) come only from experimental-table CSV columns.
  If a column or unit is unclear, the value is `null`, shown as "not reported", and listed in
  `extract/REVIEW.md`.
- The AI fills only text-derived fields and must quote the PSI text it used; unverified values
  are dropped.
- The rubric ranks; IgniterX only explains the ranking and cites a PSI ID and DOI, or a NASA page,
  for every claim.
- `data/raw/` is committed as a fixed PSI snapshot, so results are reproducible without
  re-fetching.
