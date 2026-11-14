# Website (`web/`)

The Next.js app (App Router, TypeScript, Tailwind) is built in Step 6 and deployed on Vercel
Hobby. It reads **only** `web/data/`. Never edit those files by hand; regenerate them from the
repo root:

```bash
python -m scripts.export_web          # uses cached Gemini output; --no-llm for none at all
```

## `web/data/` contents
| File | What the site does with it |
|---|---|
| `investigations.json`, `provenance.json` | Cards, compare table, "where did this value come from" |
| `scenarios.json` | Scenario picker (keys, labels, O₂ / pressure targets, default ventilation) |
| `rankings/<scenario>__<focus>__<ventilation>.json` | 32 precomputed rankings with full score breakdowns. **The site never re-scores.** Results carry `matches_focus` (draw the "Detection experiments / Other experiments" divider) and `callouts` (`closest_to_partial_gravity` → pinned E-FIELD card) |
| `explanations.json` | 2–3 sentence "why these rank highest" text for all 32 combinations |
| `demo_answers.json` | Instant answers for the 8 demo questions (also the offline fallback) |
| `rag_index.json` | Search index: chunks + Gemini vectors (768 dims, little-endian float32, base64) |
| `rag_config.json`, `rag_prompt.md` | Shared retrieval settings and the answer prompt. `/api/ask` must use these exactly as Python does |
| `rag_eval.json` | Parity fixture: query vectors and expected chunk IDs for the 8 demo questions. The TypeScript retrieval tests must reproduce these IDs in order |
| `sources.json` | All 10 NASA resources, with a verified 2-sentence summary for each text resource |
| `rubric.md` | Scoring method page |
| `meta.json` | Export time, git commit, counts, model IDs |

## Runtime rule
Only `/api/ask` calls Gemini (query embedding + answer). `GEMINI_API_KEY` lives in Vercel
environment variables, never in client code. Questions are capped at
`rag_config.answer.max_question_chars` (300). Answers about the Moon, Mars or partial/reduced
gravity get the fixed `rag_config.known_gaps.note` underneath.
