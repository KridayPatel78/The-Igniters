# Scoring sanity report (real data, 24 investigations)

Generated from `data/processed/investigations.json` with the formulas in `rank/README.md`
(Step 4: evidence-only flow scoring, focus grouping, ACME pillars = prevention, E-FIELD callout).
The **focus** column shows whether an investigation is in the focus group; with focus `all`,
every investigation is in it.

## Merge checks

- ✅ pass — `moon_base/detection` top group = the detection-pillar investigations (PSI-102, PSI-101, PSI-60, PSI-47, PSI-115), incl. SAME, SAME-R, DAFT
- ✅ pass — `moon_base/suppression` top group has FLEX + FLEX-2 and no ACME (PSI-68, PSI-25, PSI-69, PSI-39, PSI-26, PSI-142, PSI-106, PSI-60, PSI-117)
- ✅ pass — SAFFIRE/BASS near the top: iss_cabin/all top 3 = SAFFIRE-I, SAFFIRE-II, BASS-II; moon_base/all top 3 = SAFFIRE-II, SAFFIRE-I, FLEX-2

## Top 10 per run

### iss_cabin / focus=all

`python -m rank.score --scenario iss_cabin --focus all --top 10`

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PSI-98 | SAFFIRE-I | 93.4 | 34.4 | 15 | 20 | 14 | 10 | ✓ |
| 2 | PSI-99 | SAFFIRE-II | 93.4 | 34.4 | 15 | 20 | 14 | 10 | ✓ |
| 3 | PSI-25 | BASS-II | 82 | 35 | 0 | 20 | 17 | 10 | ✓ |
| 4 | PSI-68 | FLEX-2 | 77 | 35 | 15 | 4 | 14 | 9 | ✓ |
| 5 | PSI-39 | CFI | 65 | 35 | 0 | 4 | 17 | 9 | ✓ |
| 6 | PSI-10 | ACME/Flame Design | 64 | 35 | 0 | 6 | 14 | 9 | ✓ |
| 7 | PSI-159 | ACME CFI-G | 64 | 35 | 0 | 6 | 14 | 9 | ✓ |
| 8 | PSI-69 | FLEX | 63 | 35 | 0 | 4 | 14 | 10 | ✓ |
| 9 | PSI-20 | ACME BRE | 62 | 35 | 0 | 6 | 14 | 7 | ✓ |
| 10 | PSI-100 | SAFFIRE-III | 59 | 0 | 15 | 20 | 14 | 10 | ✓ |

### moon_base / focus=all

`python -m rank.score --scenario moon_base --focus all --top 10`

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PSI-99 | SAFFIRE-II | 84.8 | 25.8 | 15 | 20 | 14 | 10 | ✓ |
| 2 | PSI-98 | SAFFIRE-I | 84.3 | 25.3 | 15 | 20 | 14 | 10 | ✓ |
| 3 | PSI-68 | FLEX-2 | 77 | 35 | 15 | 4 | 14 | 9 | ✓ |
| 4 | PSI-25 | BASS-II | 72.9 | 25.9 | 0 | 20 | 17 | 10 | ✓ |
| 5 | PSI-10 | ACME/Flame Design | 64 | 35 | 0 | 6 | 14 | 9 | ✓ |
| 6 | PSI-159 | ACME CFI-G | 64 | 35 | 0 | 6 | 14 | 9 | ✓ |
| 7 | PSI-69 | FLEX | 63 | 35 | 0 | 4 | 14 | 10 | ✓ |
| 8 | PSI-20 | ACME BRE | 62 | 35 | 0 | 6 | 14 | 7 | ✓ |
| 9 | PSI-100 | SAFFIRE-III | 59 | 0 | 15 | 20 | 14 | 10 | ✓ |
| 10 | PSI-102 | SAME | 58 | 0 | 15 | 20 | 14 | 9 | ✓ |

### moon_base / focus=prevention

`python -m rank.score --scenario moon_base --focus prevention --top 10`

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PSI-99 | SAFFIRE-II | 90.8 | 25.8 | 15 | 20 | 20 | 10 | ✓ |
| 2 | PSI-98 | SAFFIRE-I | 90.3 | 25.3 | 15 | 20 | 20 | 10 | ✓ |
| 3 | PSI-25 | BASS-II | 75.9 | 25.9 | 0 | 20 | 20 | 10 | ✓ |
| 4 | PSI-10 | ACME/Flame Design | 70 | 35 | 0 | 6 | 20 | 9 | ✓ |
| 5 | PSI-159 | ACME CFI-G | 70 | 35 | 0 | 6 | 20 | 9 | ✓ |
| 6 | PSI-20 | ACME BRE | 68 | 35 | 0 | 6 | 20 | 7 | ✓ |
| 7 | PSI-100 | SAFFIRE-III | 65 | 0 | 15 | 20 | 20 | 10 | ✓ |
| 8 | PSI-39 | CFI | 57.5 | 24.5 | 0 | 4 | 20 | 9 | ✓ |
| 9 | PSI-26 | BASS | 50 | 0 | 0 | 20 | 20 | 10 | ✓ |
| 10 | PSI-62 | not reported | 42 | 0 | 0 | 20 | 20 | 2 | ✓ |

### moon_base / focus=detection

`python -m rank.score --scenario moon_base --focus detection --top 10`

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PSI-102 | SAME | 64 | 0 | 15 | 20 | 20 | 9 | ✓ |
| 2 | PSI-101 | SAME-R | 50 | 0 | 0 | 20 | 20 | 10 | ✓ |
| 3 | PSI-60 | not reported | 28 | 0 | 0 | 6 | 20 | 2 | ✓ |
| 4 | PSI-47 | DAFT / DAFT-2 | 27 | 0 | 0 | 0 | 20 | 7 | ✓ |
| 5 | PSI-115 | not reported | 20 | 0 | 0 | 0 | 20 | 0 | ✓ |
| 6 | PSI-99 | SAFFIRE-II | 76.8 | 25.8 | 15 | 20 | 6 | 10 | other |
| 7 | PSI-98 | SAFFIRE-I | 76.3 | 25.3 | 15 | 20 | 6 | 10 | other |
| 8 | PSI-68 | FLEX-2 | 69 | 35 | 15 | 4 | 6 | 9 | other |
| 9 | PSI-25 | BASS-II | 61.9 | 25.9 | 0 | 20 | 6 | 10 | other |
| 10 | PSI-10 | ACME/Flame Design | 56 | 35 | 0 | 6 | 6 | 9 | other |

### moon_base / focus=suppression

`python -m rank.score --scenario moon_base --focus suppression --top 10`

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PSI-68 | FLEX-2 | 83 | 35 | 15 | 4 | 20 | 9 | ✓ |
| 2 | PSI-25 | BASS-II | 75.9 | 25.9 | 0 | 20 | 20 | 10 | ✓ |
| 3 | PSI-69 | FLEX | 69 | 35 | 0 | 4 | 20 | 10 | ✓ |
| 4 | PSI-39 | CFI | 57.5 | 24.5 | 0 | 4 | 20 | 9 | ✓ |
| 5 | PSI-26 | BASS | 50 | 0 | 0 | 20 | 20 | 10 | ✓ |
| 6 | PSI-142 | not reported | 37 | 0 | 0 | 10 | 20 | 7 | ✓ |
| 7 | PSI-106 | SLICE | 36 | 0 | 0 | 6 | 20 | 10 | ✓ |
| 8 | PSI-60 | not reported | 28 | 0 | 0 | 6 | 20 | 2 | ✓ |
| 9 | PSI-117 | not reported | 27 | 0 | 0 | 4 | 20 | 3 | ✓ |
| 10 | PSI-99 | SAFFIRE-II | 76.8 | 25.8 | 15 | 20 | 6 | 10 | other |

### spacesuit / focus=all

`python -m rank.score --scenario spacesuit --focus all --top 10`

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PSI-98 | SAFFIRE-I | 49 | 0 | 5 | 20 | 14 | 10 | ✓ |
| 2 | PSI-99 | SAFFIRE-II | 49 | 0 | 5 | 20 | 14 | 10 | ✓ |
| 3 | PSI-100 | SAFFIRE-III | 49 | 0 | 5 | 20 | 14 | 10 | ✓ |
| 4 | PSI-102 | SAME | 48 | 0 | 5 | 20 | 14 | 9 | ✓ |
| 5 | PSI-25 | BASS-II | 47 | 0 | 0 | 20 | 17 | 10 | ✓ |
| 6 | PSI-26 | BASS | 47 | 0 | 0 | 20 | 17 | 10 | ✓ |
| 7 | PSI-10 | ACME/Flame Design | 46.5 | 17.5 | 0 | 6 | 14 | 9 | ✓ |
| 8 | PSI-159 | ACME CFI-G | 46.5 | 17.5 | 0 | 6 | 14 | 9 | ✓ |
| 9 | PSI-101 | SAME-R | 44 | 0 | 0 | 20 | 14 | 10 | ✓ |
| 10 | PSI-62 | not reported | 36 | 0 | 0 | 20 | 14 | 2 | ✓ |

### moon_base / focus=all / ventilation=quiescent

`python -m rank.score --scenario moon_base --focus all --ventilation quiescent --top 10`

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PSI-99 | SAFFIRE-II | 74.8 | 25.8 | 5 | 20 | 14 | 10 | ✓ |
| 2 | PSI-98 | SAFFIRE-I | 74.3 | 25.3 | 5 | 20 | 14 | 10 | ✓ |
| 3 | PSI-25 | BASS-II | 72.9 | 25.9 | 0 | 20 | 17 | 10 | ✓ |
| 4 | PSI-68 | FLEX-2 | 67 | 35 | 5 | 4 | 14 | 9 | ✓ |
| 5 | PSI-10 | ACME/Flame Design | 64 | 35 | 0 | 6 | 14 | 9 | ✓ |
| 6 | PSI-159 | ACME CFI-G | 64 | 35 | 0 | 6 | 14 | 9 | ✓ |
| 7 | PSI-69 | FLEX | 63 | 35 | 0 | 4 | 14 | 10 | ✓ |
| 8 | PSI-20 | ACME BRE | 62 | 35 | 0 | 6 | 14 | 7 | ✓ |
| 9 | PSI-39 | CFI | 54.5 | 24.5 | 0 | 4 | 17 | 9 | ✓ |
| 10 | PSI-100 | SAFFIRE-III | 49 | 0 | 5 | 20 | 14 | 10 | ✓ |

## Top 3 of moon_base / all — full breakdown

### 1. PSI-99 SAFFIRE-II — 84.8/100

| criterion | points | reason |
|---|---|---|
| oxygen | 25.8/35 | Tested at 21.5–22.1% O₂; scenario is 30% → 7.9 points away → 25.8/35 |
| flow | 15/15 | Airflow 20 cm/s (ventilated) matches the ventilated scenario → 15/15 |
| material | 20/20 | Solid fuels (14 base) incl. cotton, Nomex, PMMA, silicone, SIBAL (habitat materials, +6) → 20/20 |
| pillars | 14/20 | Covers 1 pillar (prevention) → 14/20 |
| richness | 10/10 | Experimental table with 15 test rows (+5); 5 measurement types (+5) → 10/10 |

Notes: Pressure not reported; No real partial-gravity combustion data exists yet (LUCI, FM2 planned); Some fields AI-extracted, not yet hand-checked

### 2. PSI-98 SAFFIRE-I — 84.3/100

| criterion | points | reason |
|---|---|---|
| oxygen | 25.3/35 | Tested at 21.5–21.7% O₂; scenario is 30% → 8.3 points away → 25.3/35 |
| flow | 15/15 | Airflow 20 cm/s (ventilated) matches the ventilated scenario → 15/15 |
| material | 20/20 | Solid fuels (14 base) incl. fabric, SIBAL (habitat materials, +6) → 20/20 |
| pillars | 14/20 | Covers 1 pillar (prevention) → 14/20 |
| richness | 10/10 | Experimental table with 4 test rows (+5); 5 measurement types (+5) → 10/10 |

Notes: Pressure not reported; No real partial-gravity combustion data exists yet (LUCI, FM2 planned); Some fields AI-extracted, not yet hand-checked

### 3. PSI-68 FLEX-2 — 77.0/100

| criterion | points | reason |
|---|---|---|
| oxygen | 35.0/35 | Tested at 17–30% O₂; scenario is 30% → within the tested range → 35/35 |
| flow | 15/15 | Airflow 0.1–5 cm/s (ventilated) matches the ventilated scenario → 15/15 |
| material | 4/20 | Liquid droplet fuels (4 base), no habitat material named in PSI fuels → 4/20 |
| pillars | 14/20 | Covers 1 pillar (suppression) → 14/20 |
| richness | 9/10 | Experimental table with 8 test rows (+5); 4 measurement types (+4) → 9/10 |

Notes: Tested at 7.3–44.1 psi; scenario is 10.2 psi; No real partial-gravity combustion data exists yet (LUCI, FM2 planned); Some fields AI-extracted, not yet hand-checked

## Callout

- moon_base: PSI-22 ACME E-FIELD Flames → `callouts: ['closest_to_partial_gravity']` (total 30, shown as a pinned card)
