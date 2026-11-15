# Flame in Freefall: website (`web/`)

Next.js 16 (App Router, TypeScript strict, Tailwind 4) deployed on **Vercel Hobby (free)**.
- **Static:** every page is prerendered. That includes the 24 investigation pages and the 32
  ranking files, so the site works even if Gemini is down.
- **Dynamic:** only `POST /api/ask` (the question box) runs at request time and calls Gemini.

The site reads only `web/data/`. Never edit those files by hand; regenerate them from the repo root
with `python -m scripts.export_web` (see the root README). **The website never computes scores.**

## Local development

```bash
cd web
npm install
cp ../.env .env.local            # or create it: GEMINI_API_KEY=... (optional GEMINI_MODEL=...)
npm run dev                      # http://localhost:3000
```

`.env.local` is gitignored. Without a key the site still works: the question box falls back to
cited NASA passages.

| Command | What it checks |
|---|---|
| `npm test` | vitest, offline: **parity** (TypeScript retrieval = Python retrieval on `rag_eval.json`), citations, fallbacks, input validation, rate limiter, data loaders |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (run `npx next typegen` first on a fresh clone) |
| `npm run build && npm run start` | production build, served locally |

## Pages
| Route | What it shows |
|---|---|
| `/` | Scenario × focus × ventilation picker (state in the URL), "Why these rank highest", Known gaps + "Closest to partial gravity" card for Moon/Mars, ranked cards with the A–E breakdown and every reason, compare tray |
| `/investigations/[id]` | Key facts, fuels, sensors, objective / findings / Earth uses, score in each scenario, the full test table, "Where this came from" (provenance of every field) |
| `/compare?ids=PSI-98,PSI-26` | 2–4 investigations side by side + SVG chart of tested O₂ vs. habitat targets |
| `/ask` | Question box (≤ 300 chars), 8 instant demo answers, numbered citations, mode badge, Known-gaps note for Moon/Mars/partial-gravity questions |
| `/context` | Apollo 1, Apollo 13, Mir; Earth spin-offs; Known gaps |
| `/method` | Principles, data flow, the rubric (`rubric.md`), PSI coverage, all 10 data sources, build metadata |
| `/data/rankings/[key]` | The 24 precomputed rankings as static JSON (used by the Explore page) |

## `/api/ask` (the only runtime Gemini call)
- **Logic:** `lib/rag/` is a 1:1 port of `rag/ask.py`. It uses the same chunks and vectors
  (`rag_index.json`), the same hybrid search and settings (`rag_config.json`), the same prompt
  (`rag_prompt.md`) and the same citation checks.
- **Flow:**
  1. Validate the input.
  2. If the question exactly matches a demo question, return the cached answer.
  3. Embed the query (`RETRIEVAL_QUERY`, 768 dims, normalized).
  4. Run hybrid retrieval.
  5. If the best similarity is below the threshold, return `not_covered` without calling Gemini.
  6. Otherwise call Gemini, map `[S#]` markers to numbered citations, and drop invalid ones.
- **Fallbacks:**
  - If the embedding call fails → keyword-only retrieval → `passages`.
  - If the answer call fails → `passages`.
  - A Gemini outage never returns a 500.
- **Abuse protection:** 10 requests per minute per IP (in memory, best effort), bodies over 2 KB
  rejected, `POST` only.
- **Secrets:** `GEMINI_API_KEY` is read only in `lib/rag/server.ts` (`server-only`). It is never
  logged and never sent to the client.

## `web/data/` contents
| File | Used for |
|---|---|
| `investigations.json`, `provenance.json` | Cards, detail pages, compare table, provenance |
| `scenarios.json` | Scenario picker |
| `rankings/<scenario>__<focus>__<ventilation>.json` | 24 precomputed rankings with full breakdowns, `matches_focus`, `callouts` |
| `explanations.json` | "Why these rank highest" for all 24 combinations |
| `demo_answers.json` | Instant demo answers / offline fallback |
| `rag_index.json`, `rag_config.json`, `rag_prompt.md` | Search index, shared settings, answer prompt |
| `rag_eval.json` | Parity fixture for the retrieval tests |
| `sources.json`, `rubric.md`, `meta.json` | Data sources with summaries, method page, build metadata |

## Deploy on Vercel (free Hobby plan)
1. vercel.com → sign in with GitHub → **Add New → Project** → import `KridayPatel78/The-Igniters`.
2. **Root Directory: `web`**. Framework preset: Next.js (auto). Build/output: defaults.
3. **Environment Variables** (Production + Preview): `GEMINI_API_KEY` (secret), `GEMINI_MODEL`
   (optional). Nothing with `NEXT_PUBLIC_`.
4. Deploy. The production URL becomes the link for the Space Apps submission.
5. After deploy, open these and check the function logs in Vercel for errors:
   - `/`
   - a detail page
   - `/compare`
   - `/ask`: try a demo chip and one live question
   - `/method`

**Notes**
- **Hobby plan:** free and for non-commercial use, which is fine for a hackathon.
- **Every push to `main` redeploys production automatically, so don't push during judging.**
- **Preview deployments** are created for other branches (e.g. `web`), so changes can be reviewed
  before merging.
