# Scoring rubric (exact formulas)

Every investigation gets a score from **0 to 100** for a chosen **scenario** (where the crew
lives) and **focus** (which fire-safety pillar you care about). The score is plain arithmetic on
values that trace to PSI — no AI decides it. Every point comes with a one-line reason built from
the real values, and the dashboard shows that breakdown next to every score.

```bash
python -m rank.score --scenario moon_base --focus all [--ventilation quiescent] [--top 10]
```

```python
from rank.score import load_inputs, rank, score_investigation
records, placeholders = load_inputs()
ranked = rank(records, "moon_base", focus="all", ventilation=None, placeholders=placeholders)
```

All constants live in `rank/config.py`.

**Principle: we only award points for evidence in NASA's data. "Not reported" scores 0, and
the reason says so.**

## Scenarios (from the challenge brief)

| key | scenario | target O₂ | pressure (shown, not scored) | default airflow |
|---|---|---|---|---|
| `iss_cabin` | ISS cabin | 21 % | 14.7 psi | ventilated |
| `moon_base` | Moon base / pressurized rover | 30 % | 10.2 psi | ventilated |
| `spacesuit` | Spacesuit | 100 % | 4.3 psi | quiescent |

`ventilation` can be flipped by the user ("ventilation failed" = `quiescent`).

## The five criteria

**A. Oxygen closeness — up to 35**
- Take the investigation's tested O₂ range `[lo, hi]` and the scenario target `T`.
- Distance `d` = 0 if `lo ≤ T ≤ hi`, otherwise the gap to the nearest end of the range.
- `points = 35 × max(0, 1 − d / 30)`: full marks inside the range, and 0 once 30 percentage
  points or more away.
- O₂ not reported in the PSI tables → 0.
- Example: tested at 21.5–21.7 %, Moon base 30 % → 8.3 points away → 25.3 / 35.

**B. Flow regime match — up to 15**
- Regime from airflow: highest airflow > 0 → *ventilated*; `[0, 0]` → *quiescent*;
  not reported → *unknown*.
- Same as the scenario → 15. Different → 5 (still informative). Not reported → **0**
  ("Airflow not reported in PSI tables — no points without evidence").

**C. Material relevance — up to 20**
- Base by fuel phase: solid 14, mixed 10, gas 6, liquid droplet 4, unknown 0.
- A value that only fills a contract slot counts as unknown. These values are marked
  `"placeholder": true` in `data/processed/provenance.json`.
- +6 if any listed fuel names a habitat material. The keywords: fabric, cotton, Nomex, PMMA,
  acrylic, plastic, polymer, Ultem, silicone, foam, wire, insulation, SIBAL, Delrin,
  polyethylene, Kapton. They are case-insensitive.
- Capped at 20.

**D. Pillar coverage, weighted by focus — up to 20**
- Focus `all`: 1 pillar → 14, 2 → 17, 3 → 20, none → 0.
- Focus `prevention` / `detection` / `suppression`: covers that pillar → 20; covers only other
  pillars → 6; none → 0.

**E. Data richness — up to 10**
- Experimental table present → 5.
- +1 per measurement type, up to +5.

**Total** = A + B + C + D + E. Each criterion is rounded to 1 decimal.
**Ranking**
- Focus `all`: highest total first. Ties go to higher data richness, then to the lower PSI
  number.
- Focus on one pillar (e.g. `detection`): investigations covering that pillar come first as
  one group, then all the others. Each group is sorted as above.
- Grouping never changes a score. Each result has `matches_focus: true/false`, so the app can
  draw a divider ("Detection experiments" / "Other experiments").

## Notes shown with every score (never scored)
- Pressure: "Tested at X psi; scenario is Y psi", or "Pressure not reported".
- E-FIELD Flames (`gravity = partial_mimic`): "Electric field used to mimic partial gravity —
  closest PSI data to Moon gravity".
- Moon base scenario: "No real partial-gravity combustion data exists yet (LUCI, FM2
  planned)".
- `extraction_confidence = llm_unchecked`: "Some fields AI-extracted, not yet hand-checked".

## Callouts (pinned cards, never scored)
- `callouts: ["closest_to_partial_gravity"]` on E-FIELD Flames (`gravity = partial_mimic`) in the
  `moon_base` scenario.

## What each result looks like
```json
{"psi_id": "PSI-98", "acronym": "SAFFIRE-I", "title": "...", "total": 84.3,
 "breakdown": [{"criterion": "oxygen", "points": 25.3, "max": 35,
                "reason": "Tested at 21.5–21.7% O₂; scenario is 30% → 8.3 points away → 25.3/35",
                "inputs": {"o2_percent_range": [21.5, 21.7], "target": 30, "distance": 8.3}},
               "... flow, material, pillars, richness ..."],
 "matches_focus": true,
 "notes": ["Pressure not reported", "..."],
 "callouts": []}
```
