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
