# AI librarian (`rag/`)

Answers questions **only from our NASA sources**, with a citation on every claim:
`[PSI-98 · doi:10.60555/…]` for PSI investigations, `[Apollo 1 · sma.nasa.gov/…]` for the
other challenge resources. If the sources don't cover a question, it says
"Not covered by our NASA sources." It keeps working without Wi-Fi or Gemini.

```bash
python -m rag.fetch_resources     # 8 text resources -> data/raw/resources/<id>.txt (once; committed)
python -m rag.build_index         # PSI text + fact cards + resources -> data/chroma/ (gitignored)
python -m rag.ask "How was smoke detection tested on the ISS?"
python -m rag.ask --demo          # -> data/processed/demo_answers.json + demo_explanations.json
```

```python
from rag.ask import answer          # {question, answer, citations, covered, mode}
from rag.explain import explain_ranking
```

Run `build_index` once after cloning, since `data/chroma/` is not in git. The first run
downloads the small embedding model (~90 MB) to the Hugging Face cache.

## What is indexed
| kind | from | cited as |
|---|---|---|
| PSI text | `objective`, `approach`, `hypothesis`, `researchImpacts`, `description` of `data/raw/<ID>.json` | PSI ID + DOI |
| Fact cards | one per investigation from `data/processed/investigations.json` (fuels, O₂ / pressure / airflow, pillars, gravity, measurements; `not reported` for nulls) | PSI ID + DOI |
| Comparison tables | O₂, pressure and airflow ranges of all 24 investigations in one chunk each (each row has its PSI ID + DOI), for questions like "which experiments went above 30 % O₂?" | PSI comparison table |
| Resources | `data/raw/resources/*.txt` (NASA Combustion Science, the Researcher's Guide PDF, Apollo 1, Apollo 13, Mir fire, 3 Spinoffs) | title + URL |

Chunks are about 1,000 characters with about 150 characters of overlap, split on paragraphs and
never inside a word.

## How an answer is made
1. **Retrieve** with a hybrid search:
   - Embedding similarity (`all-MiniLM-L6-v2`) and BM25 keyword search are combined by
     reciprocal-rank fusion.
   - The keyword search uses a small fire-safety synonym list ("put out" → extinguish /
     suppressant, Moon → lunar, …).
   - At most 3 chunks per investigation or resource, so the 50-page Researcher's Guide can't
     crowd out PSI.
   - Settings: `rag/config.py`.
2. **Gate:** if the best cosine similarity is below `MIN_SIMILARITY` (0.30), the answer is "not
   covered" and **Gemini is not called**.
   - Calibration: on-topic demo questions scored 0.45–0.72; off-topic probes (pizza, World Cup,
     sourdough, Paris, bike tyres, stocks) scored 0.11–0.23.
3. **Generate** with Gemini:
   - Sources are numbered `[S1]…[S8]`.
   - Rules: only the sources; a marker after every factual sentence; experiment numbers only
     from PSI; answer the covered part and name the uncovered part; `NOT_COVERED` if nothing is
     relevant; ≤ 150 words.
4. **Check in code:**
   - `[S#]` markers are replaced by real labels, and unknown ones are dropped.
   - If no valid citation is left, or the reply is `NOT_COVERED`, the answer is "not covered".
   - Only citations that are actually used are returned.
5. **Offline:** if there is no key, no network or an API error, `mode="passages"` returns the top 3
   passages with citations under "AI summary unavailable — here are the most relevant NASA
   passages."

`explain_ranking()` (`rag/explain.py`) explains `rank.rank()`'s top 3 from their reason strings
only. The rubric decides and the LLM only explains. If its text contains a number that isn't in
the reasons, or names the three out of order, the template explanation built from the reason
strings is used instead.
