# Scoring sanity report (real data, 24 investigations)

Generated from `data/processed/investigations.json` (the extract merge on `main`, plus the
fuel_phase overrides) using the formulas in `rank/README.md`. **The formulas have not been
tuned.** The assessment at the bottom lists what looks right and what looks off, for KP to decide.

## Top 10 per run

### iss_cabin / focus=all

```
python -m rank.score --scenario iss_cabin --focus all --top 10
```

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data |
|---|---|---|---|---|---|---|---|---|
| 1 | PSI-98 | SAFFIRE-I | 93.4 | 34.4 | 15 | 20 | 14 | 10 |
| 2 | PSI-99 | SAFFIRE-II | 93.4 | 34.4 | 15 | 20 | 14 | 10 |
| 3 | PSI-25 | BASS-II | 89.5 | 35 | 7.5 | 20 | 17 | 10 |
| 4 | PSI-68 | FLEX-2 | 77 | 35 | 15 | 4 | 14 | 9 |
| 5 | PSI-10 | ACME/Flame Design | 74.5 | 35 | 7.5 | 6 | 17 | 9 |
| 6 | PSI-159 | ACME CFI-G | 74.5 | 35 | 7.5 | 6 | 17 | 9 |
| 7 | PSI-39 | CFI | 72.5 | 35 | 7.5 | 4 | 17 | 9 |
| 8 | PSI-69 | FLEX | 70.5 | 35 | 7.5 | 4 | 14 | 10 |
| 9 | PSI-20 | ACME BRE | 69.5 | 35 | 7.5 | 6 | 14 | 7 |
| 10 | PSI-100 | SAFFIRE-III | 59 | 0 | 15 | 20 | 14 | 10 |

### moon_base / focus=all

```
python -m rank.score --scenario moon_base --focus all --top 10
```

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data |
|---|---|---|---|---|---|---|---|---|
| 1 | PSI-99 | SAFFIRE-II | 84.8 | 25.8 | 15 | 20 | 14 | 10 |
| 2 | PSI-98 | SAFFIRE-I | 84.3 | 25.3 | 15 | 20 | 14 | 10 |
| 3 | PSI-25 | BASS-II | 80.4 | 25.9 | 7.5 | 20 | 17 | 10 |
| 4 | PSI-68 | FLEX-2 | 77 | 35 | 15 | 4 | 14 | 9 |
| 5 | PSI-10 | ACME/Flame Design | 74.5 | 35 | 7.5 | 6 | 17 | 9 |
| 6 | PSI-159 | ACME CFI-G | 74.5 | 35 | 7.5 | 6 | 17 | 9 |
| 7 | PSI-69 | FLEX | 70.5 | 35 | 7.5 | 4 | 14 | 10 |
| 8 | PSI-20 | ACME BRE | 69.5 | 35 | 7.5 | 6 | 14 | 7 |
| 9 | PSI-39 | CFI | 62 | 24.5 | 7.5 | 4 | 17 | 9 |
| 10 | PSI-100 | SAFFIRE-III | 59 | 0 | 15 | 20 | 14 | 10 |

### moon_base / focus=prevention

```
python -m rank.score --scenario moon_base --focus prevention --top 10
```

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data |
|---|---|---|---|---|---|---|---|---|
| 1 | PSI-99 | SAFFIRE-II | 90.8 | 25.8 | 15 | 20 | 20 | 10 |
| 2 | PSI-98 | SAFFIRE-I | 90.3 | 25.3 | 15 | 20 | 20 | 10 |
| 3 | PSI-25 | BASS-II | 83.4 | 25.9 | 7.5 | 20 | 20 | 10 |
| 4 | PSI-10 | ACME/Flame Design | 77.5 | 35 | 7.5 | 6 | 20 | 9 |
| 5 | PSI-159 | ACME CFI-G | 77.5 | 35 | 7.5 | 6 | 20 | 9 |
| 6 | PSI-20 | ACME BRE | 75.5 | 35 | 7.5 | 6 | 20 | 7 |
| 7 | PSI-68 | FLEX-2 | 69 | 35 | 15 | 4 | 6 | 9 |
| 8 | PSI-100 | SAFFIRE-III | 65 | 0 | 15 | 20 | 20 | 10 |
| 9 | PSI-39 | CFI | 65 | 24.5 | 7.5 | 4 | 20 | 9 |
| 10 | PSI-69 | FLEX | 62.5 | 35 | 7.5 | 4 | 6 | 10 |

### moon_base / focus=detection

```
python -m rank.score --scenario moon_base --focus detection --top 10
```

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data |
|---|---|---|---|---|---|---|---|---|
| 1 | PSI-99 | SAFFIRE-II | 76.8 | 25.8 | 15 | 20 | 6 | 10 |
| 2 | PSI-98 | SAFFIRE-I | 76.3 | 25.3 | 15 | 20 | 6 | 10 |
| 3 | PSI-25 | BASS-II | 69.4 | 25.9 | 7.5 | 20 | 6 | 10 |
| 4 | PSI-68 | FLEX-2 | 69 | 35 | 15 | 4 | 6 | 9 |
| 5 | PSI-102 | SAME | 64 | 0 | 15 | 20 | 20 | 9 |
| 6 | PSI-10 | ACME/Flame Design | 63.5 | 35 | 7.5 | 6 | 6 | 9 |
| 7 | PSI-159 | ACME CFI-G | 63.5 | 35 | 7.5 | 6 | 6 | 9 |
| 8 | PSI-69 | FLEX | 62.5 | 35 | 7.5 | 4 | 6 | 10 |
| 9 | PSI-20 | ACME BRE | 61.5 | 35 | 7.5 | 6 | 6 | 7 |
| 10 | PSI-101 | SAME-R | 57.5 | 0 | 7.5 | 20 | 20 | 10 |

### moon_base / focus=suppression

```
python -m rank.score --scenario moon_base --focus suppression --top 10
```

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data |
|---|---|---|---|---|---|---|---|---|
| 1 | PSI-25 | BASS-II | 83.4 | 25.9 | 7.5 | 20 | 20 | 10 |
| 2 | PSI-68 | FLEX-2 | 83 | 35 | 15 | 4 | 20 | 9 |
| 3 | PSI-10 | ACME/Flame Design | 77.5 | 35 | 7.5 | 6 | 20 | 9 |
| 4 | PSI-159 | ACME CFI-G | 77.5 | 35 | 7.5 | 6 | 20 | 9 |
| 5 | PSI-99 | SAFFIRE-II | 76.8 | 25.8 | 15 | 20 | 6 | 10 |
| 6 | PSI-69 | FLEX | 76.5 | 35 | 7.5 | 4 | 20 | 10 |
| 7 | PSI-98 | SAFFIRE-I | 76.3 | 25.3 | 15 | 20 | 6 | 10 |
| 8 | PSI-39 | CFI | 65 | 24.5 | 7.5 | 4 | 20 | 9 |
| 9 | PSI-20 | ACME BRE | 61.5 | 35 | 7.5 | 6 | 6 | 7 |
| 10 | PSI-26 | BASS | 57.5 | 0 | 7.5 | 20 | 20 | 10 |

### spacesuit / focus=all

```
python -m rank.score --scenario spacesuit --focus all --top 10
```

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data |
|---|---|---|---|---|---|---|---|---|
| 1 | PSI-10 | ACME/Flame Design | 57 | 17.5 | 7.5 | 6 | 17 | 9 |
| 2 | PSI-159 | ACME CFI-G | 57 | 17.5 | 7.5 | 6 | 17 | 9 |
| 3 | PSI-25 | BASS-II | 54.5 | 0 | 7.5 | 20 | 17 | 10 |
| 4 | PSI-26 | BASS | 54.5 | 0 | 7.5 | 20 | 17 | 10 |
| 5 | PSI-101 | SAME-R | 51.5 | 0 | 7.5 | 20 | 14 | 10 |
| 6 | PSI-98 | SAFFIRE-I | 49 | 0 | 5 | 20 | 14 | 10 |
| 7 | PSI-99 | SAFFIRE-II | 49 | 0 | 5 | 20 | 14 | 10 |
| 8 | PSI-100 | SAFFIRE-III | 49 | 0 | 5 | 20 | 14 | 10 |
| 9 | PSI-102 | SAME | 48 | 0 | 5 | 20 | 14 | 9 |
| 10 | PSI-62 | not reported | 43.5 | 0 | 7.5 | 20 | 14 | 2 |

### moon_base / focus=all / ventilation=quiescent

```
python -m rank.score --scenario moon_base --focus all --ventilation quiescent --top 10
```

| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data |
|---|---|---|---|---|---|---|---|---|
| 1 | PSI-25 | BASS-II | 80.4 | 25.9 | 7.5 | 20 | 17 | 10 |
| 2 | PSI-99 | SAFFIRE-II | 74.8 | 25.8 | 5 | 20 | 14 | 10 |
| 3 | PSI-10 | ACME/Flame Design | 74.5 | 35 | 7.5 | 6 | 17 | 9 |
| 4 | PSI-159 | ACME CFI-G | 74.5 | 35 | 7.5 | 6 | 17 | 9 |
| 5 | PSI-98 | SAFFIRE-I | 74.3 | 25.3 | 5 | 20 | 14 | 10 |
| 6 | PSI-69 | FLEX | 70.5 | 35 | 7.5 | 4 | 14 | 10 |
| 7 | PSI-20 | ACME BRE | 69.5 | 35 | 7.5 | 6 | 14 | 7 |
| 8 | PSI-68 | FLEX-2 | 67 | 35 | 5 | 4 | 14 | 9 |
| 9 | PSI-39 | CFI | 62 | 24.5 | 7.5 | 4 | 17 | 9 |
| 10 | PSI-26 | BASS | 54.5 | 0 | 7.5 | 20 | 17 | 10 |

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

### 3. PSI-25 BASS-II — 80.4/100

| criterion | points | reason |
|---|---|---|
| oxygen | 25.9/35 | Tested at 13.6–22.2% O₂; scenario is 30% → 7.8 points away → 25.9/35 |
| flow | 7.5/15 | Airflow not reported — neutral score → 7.5/15 |
| material | 20/20 | Solid fuels (14 base) incl. fabric, Nomex, PMMA, SIBAL (habitat materials, +6) → 20/20 |
| pillars | 17/20 | Covers 2 pillars (prevention, suppression) → 17/20 |
| richness | 10/10 | Experimental table with 129 test rows (+5); 5 measurement types (+5) → 10/10 |

Notes: Pressure not reported; No real partial-gravity combustion data exists yet (LUCI, FM2 planned); Some fields AI-extracted, not yet hand-checked

## Assessment: do the rankings match the domain facts in AGENTS.md?

**Looks right**
- **SAFFIRE and BASS are strong on materials.** SAFFIRE-I/II and BASS-II take the top 3 for
  ISS, Moon base and prevention. They all get 20/20 on material (solid fuels plus cotton,
  Nomex, PMMA, SIBAL) and full data richness.
- **The ISS cabin ranking is sensible.** SAFFIRE and BASS-II were tested near 21 % O₂, so they
  get almost full oxygen points and lead the list.
- **Prevention focus** puts SAFFIRE, BASS-II, ACME BRE and the ACME gas flames on top.
- **Spacesuit:** CFI-G and Flame Design (up to ~85 % O₂) are #1–2, as the brief implies. They are
  the only investigations within 30 points of 100 % O₂. Totals stay low (max 57), which honestly
  reflects that almost nothing was tested near 100 % O₂.
- **Ventilation flip works.** With `--ventilation quiescent`, the SAFFIRE runs (20 cm/s forced
  flow) lose 10 points each and drop from #1–2.

**Looks off (not fixed — your call)**
1. **Detection focus does not put SAME / SAME-R / DAFT on top.** SAME is #5, SAME-R #10, and DAFT
   is not in the top 10. SAFFIRE-I/II, BASS-II and FLEX-2 rank above them with 6/20 pillar
   points.
   - Cause: a focus hit is worth only +14 over a miss (20 vs 6). The detection experiments get
     0/35 oxygen because their tables have no O₂ column, and DAFT also gets 0 material (dust,
     placeholder).
   - So the oxygen gap (25+ points) outweighs the focus.
   - The brief expects SAME / SAME-R / DAFT on top for detection.
2. **A missing O₂ value scores 0, but missing airflow scores a neutral 7.5.**
   - SAFFIRE-III (#10 Moon base), BASS (PSI-26), SAME, SAME-R and E-FIELD lose up to 35 points
     only because their CSVs have no O₂ column. Their text implies they ran in normal cabin air.
   - This asymmetry is the main driver of point 1.
3. **Unknown airflow (7.5) beats a known mismatch (5).** For spacesuit and quiescent runs,
   SAFFIRE scores lower for *reporting* its 20 cm/s airflow than investigations that report
   nothing. Having data is punished.
4. **Suppression focus is diluted by ACME.**
   - From PSI text quotes, the AI labelled ACME Flame Design, CFI-G, CLD Flame, s-Flame and CFI
     as `suppression`. Their quotes are about "extinction limits", which is a flame-physics
     result, not a suppression system.
   - So ACME ties FLEX / FLEX-2 on the pillar score.
   - FLEX-2 (#2) and BASS-II (#1) are fine. FLEX (#6) sits below two ACME entries.
   - Fix options: a pillar override per ID, or treat "extinction" quotes as not-suppression.
5. **E-FIELD Flames (PSI-22) is not in the Moon base top 10**, though it is the only PSI data
   that mimics partial gravity. Per the spec, that fact is a note, not a score. It also has no O₂
   column and no pillars from the AI.
6. **Ties are common.** Flame Design and CFI-G score the same in every scenario: both are gas,
   both have 4 measurements, and both have O₂ ranges spanning 21–85 %. Any range that contains
   the target gets the full 35, so very wide ranges are rewarded as much as exact matches.

Possible adjustments, none applied:
- Raise the focus weight (e.g. miss = 0), or make detection/suppression focus a filter.
- Give a neutral O₂ score (e.g. 17.5) when O₂ is not reported, like airflow.
- Set unknown airflow below mismatch (e.g. 4).
- Add pillar overrides for ACME.
