# AI librarian (`rag/`)

Answers questions **only from our NASA sources**, with a citation on every claim:
`[PSI-98 · doi:10.60555/…]` for PSI investigations, `[Apollo 1 · sma.nasa.gov/…]` for the
other challenge resources. If the sources don't cover a question, it says
"Not covered by our NASA sources." It keeps working without Wi-Fi or Gemini.

```bash
python -m rag.fetch_resources     # 8 text resources -> data/raw/resources/<id>.txt (once; committed)
python -m rag.build_index         # chunks + Gemini embeddings -> data/processed/rag_index.json (committed)
python -m rag.ask "How was smoke detection tested on the ISS?"
python -m rag.ask --demo          # -> demo_answers.json, demo_explanations.json, rag_eval.json
```

**Shared with the website.** The tunable settings are in `rag/config.json` and the answer prompt
is in `rag/prompt.md`. Python and the website's `/api/ask` load the same two files, so change
them there, never in code. The settings cover the embedding model, k, the similarity threshold,
the hybrid-search weights, synonyms, the per-source cap, the known-gaps keywords and the
question length.

## What is indexed (378 chunks)
| kind | from | cited as |
|---|---|---|
| PSI text | `objective`, `approach`, `hypothesis`, `researchImpacts`, `description` of `data/raw/<ID>.json` | PSI ID + DOI |
| Fact cards | one per investigation from `investigations.json` (fuels, O₂ / pressure / airflow, pillars, gravity, measurements; `not reported` for nulls) | PSI ID + DOI |
| Comparison tables | O₂, pressure and airflow of all 24 investigations, one chunk each, with each row's PSI ID + DOI | PSI comparison table |
| Coverage | gravity conditions of all 24 investigations, counted in code (23 microgravity, 1 partial-gravity mimic, 0 Moon/Mars) | PSI coverage |
| Resources | `data/raw/resources/*.txt` (NASA Combustion Science, the Researcher's Guide PDF, Apollo 1, Apollo 13, Mir fire, 3 Spinoffs) | title + URL |

Chunks are about 1,000 characters with about 150 characters of overlap, split on paragraphs and
never inside a word.

**Embeddings:** `gemini-embedding-001`, 768 dims, L2-normalized, stored as little-endian float32
in `rag_index.json`.
- Document vectors are cached by text hash in `data/interim/embeddings/`, so a rebuild only
  embeds new or changed chunks.

## How an answer is made
1. **Embed the question** (`RETRIEVAL_QUERY`).
   - If that fails, the fallback is keyword-only retrieval → `mode="passages"`, with no LLM.
2. **Hybrid retrieval:**
   - Cosine similarity and BM25 keyword search are combined by reciprocal-rank fusion.
   - The keyword search uses the fire-safety synonyms.
   - At most 3 chunks per investigation or resource, so the 50-page Researcher's Guide can't
     crowd out PSI.
3. **Gate:** if the best similarity is below `min_similarity` (0.64), the answer is "not covered"
   and **Gemini is not called**.
   - Calibration: the 7 real demo questions scored 0.725–0.806.
   - Off-topic probes (pizza, World Cup, sourdough, Paris, bike tyres, stocks, cat jokes,
     Everest) scored 0.506–0.557.
4. **Generate** with `rag/prompt.md`. The sources are numbered `[S1]…[S8]`, and the rules are:
   - only facts from the sources
   - a marker after every factual sentence
   - experiment numbers only from PSI
   - planned or future experiments are not data
   - answer the covered part and name the uncovered part
   - `NOT_COVERED` if nothing is relevant
   - ≤ 150 words
5. **Check in code:**
   - `[S#]` markers become real labels, and unknown markers are dropped.
   - If no valid citation is left, or the reply is `NOT_COVERED`, the answer is "not covered".
   - LaTeX is stripped.
6. **Offline:** if Gemini fails, `mode="passages"` returns the top 3 passages with citations.

### Retrieval determinism (the website must match exactly)
- Tokens: lowercase, `[a-z0-9]+`, stopwords removed, length ≥ 2. Query terms are de-duplicated
  and **sorted** before BM25 (k1 1.5, b 0.75, idf = ln(1 + (N − df + 0.5)/(df + 0.5))).
- Cosine: a left-to-right double-precision sum over the float32 values.
- Fusion: rank each list by score (ties → lower chunk index), take the top 50 of each, and give
  1/(60 + rank) only where the score is > 0. Sort by (−rrf, −similarity, index), then apply the
  per-source cap until k = 8.
- `data/processed/rag_eval.json` stores each demo question's query vector and the expected chunk
  IDs. `tests/test_rag.py` checks Python against it, and the website's tests must do the same.

`explain_ranking()` (`rag/explain.py`) explains `rank.rank()`'s top 3 from their reason strings
only. The rubric decides and the LLM only explains. If the text contains a number that isn't in
the reasons, or names the three out of order, the template explanation is used instead.
