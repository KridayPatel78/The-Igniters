"""Transparent 0-100 scoring of investigations for a scenario + pillar focus. Pure, deterministic, no LLM.

Usage:
    python -m rank.score --scenario moon_base --focus all [--ventilation quiescent] [--top 10]

Every criterion returns {criterion, points, max, reason, inputs}; rubric: rank/README.md.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from rank import config as C

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"


# --- helpers ---------------------------------------------------------------------------------

def _fmt(x: float) -> str:
    return f"{round(x, 1):g}"


def _fmt_range(r) -> str:
    return _fmt(r[0]) if r[0] == r[1] else f"{_fmt(r[0])}–{_fmt(r[1])}"


def _item(criterion: str, points: float, max_points: float, reason: str, **inputs) -> dict:
    return {"criterion": criterion, "points": round(points, 1), "max": max_points, "reason": reason,
            "inputs": inputs}


def _validate(scenario_key: str, focus: str, ventilation: str | None) -> None:
    if scenario_key not in C.SCENARIOS:
        raise ValueError(f"unknown scenario {scenario_key!r}; choose from {sorted(C.SCENARIOS)}")
    if focus not in C.FOCUSES:
        raise ValueError(f"unknown focus {focus!r}; choose from {list(C.FOCUSES)}")
    if ventilation is not None and ventilation not in C.VENTILATIONS:
        raise ValueError(f"unknown ventilation {ventilation!r}; choose from {list(C.VENTILATIONS)}")


# --- criteria --------------------------------------------------------------------------------

def score_oxygen(o2_range, target: float) -> dict:
    """A. 35 inside the range, linear to 0 at O2_WINDOW points away; not reported -> 0."""
    if o2_range is None:
        return _item("oxygen", 0, C.O2_MAX, "Oxygen level not reported in PSI tables → 0/35",
                     o2_percent_range=None, target=target)
    lo, hi = o2_range
    distance = 0.0 if lo <= target <= hi else min(abs(lo - target), abs(hi - target))
    points = C.O2_MAX * max(0.0, 1 - distance / C.O2_WINDOW)
    where = "within the tested range" if distance == 0 else f"{_fmt(distance)} points away"
    reason = (f"Tested at {_fmt_range(o2_range)}% O₂; scenario is {_fmt(target)}% → {where} "
              f"→ {_fmt(points)}/{C.O2_MAX}")
    return _item("oxygen", points, C.O2_MAX, reason, o2_percent_range=o2_range, target=target, distance=distance)


def flow_regime(airflow_range) -> str:
    if airflow_range is None:
        return "unknown"
    return "ventilated" if airflow_range[1] > 0 else "quiescent"


def score_flow(airflow_range, ventilation: str) -> dict:
    """B. Match 15, mismatch 5, not reported 0 (evidence only)."""
    regime = flow_regime(airflow_range)
    if regime == "unknown":
        return _item("flow", C.FLOW_UNKNOWN, C.FLOW_MAX,
                     f"Airflow not reported in PSI tables — no points without evidence → "
                     f"{_fmt(C.FLOW_UNKNOWN)}/{C.FLOW_MAX}",
                     airflow_cm_s_range=None, regime=regime, scenario_ventilation=ventilation)
    points = C.FLOW_MATCH if regime == ventilation else C.FLOW_MISMATCH
    verdict = "matches" if regime == ventilation else "differs from"
    reason = (f"Airflow {_fmt_range(airflow_range)} cm/s ({regime}) {verdict} the {ventilation} scenario "
              f"→ {_fmt(points)}/{C.FLOW_MAX}")
    return _item("flow", points, C.FLOW_MAX, reason, airflow_cm_s_range=airflow_range, regime=regime,
                 scenario_ventilation=ventilation)


def habitat_materials(fuels: list[str]) -> list[str]:
    """Habitat-material keywords found in the fuels list (config order, case-insensitive)."""
    text = " ".join(fuels).casefold()
    return [k for k in C.HABITAT_MATERIALS if k.casefold() in text]


def score_material(fuel_phase: str, fuels: list[str], phase_is_placeholder: bool = False) -> dict:
    """C. Base by fuel phase (unknown -> 0) + 6 if a fuel is a habitat material; cap 20."""
    phase = None if phase_is_placeholder else fuel_phase
    base = C.PHASE_BASE.get(phase, 0)
    matched = habitat_materials(fuels)
    points = min(C.MATERIAL_MAX, base + (C.HABITAT_MATERIAL_BONUS if matched else 0))
    label = C.PHASE_LABEL.get(phase, "Fuel phase unknown")
    reason = f"{label} ({base} base)"
    if matched:
        reason += f" incl. {', '.join(matched)} (habitat materials, +{C.HABITAT_MATERIAL_BONUS})"
    else:
        reason += ", no habitat material named in PSI fuels"
    return _item("material", points, C.MATERIAL_MAX, f"{reason} → {_fmt(points)}/{C.MATERIAL_MAX}",
                 fuel_phase=fuel_phase, phase_is_placeholder=phase_is_placeholder, matched=matched)


def score_pillars(pillars: list[str], focus: str) -> dict:
    """D. focus=all: 1/2/3 pillars -> 14/17/20; focus=<pillar>: covers it 20, other only 6, none 0."""
    covered = [p for p in ("prevention", "detection", "suppression") if p in pillars]
    if not covered:
        return _item("pillars", 0, C.PILLAR_MAX, f"No fire-safety pillar identified → 0/{C.PILLAR_MAX}",
                     pillars=covered, focus=focus)
    if focus == "all":
        points = C.PILLARS_ALL_FOCUS[len(covered)]
        reason = f"Covers {len(covered)} pillar{'s' * (len(covered) > 1)} ({', '.join(covered)})"
    elif focus in covered:
        points, reason = C.PILLAR_FOCUS_HIT, f"Covers the {focus} focus ({', '.join(covered)})"
    else:
        points, reason = C.PILLAR_FOCUS_OTHER, f"Does not cover {focus}; covers {', '.join(covered)}"
    return _item("pillars", points, C.PILLAR_MAX, f"{reason} → {_fmt(points)}/{C.PILLAR_MAX}",
                 pillars=covered, focus=focus)


def score_richness(tests: list, measurements: list[str]) -> dict:
    """E. Experimental table 5 + 1 per measurement type (max +5)."""
    table = C.RICHNESS_TABLE if tests else 0
    extra = min(C.RICHNESS_MEASUREMENT_CAP, C.RICHNESS_PER_MEASUREMENT * len(measurements))
    points = table + extra
    table_txt = f"experimental table with {len(tests)} test rows (+{table})" if tests else "no experimental table (+0)"
    reason = f"{table_txt}; {len(measurements)} measurement types (+{extra}) → {_fmt(points)}/{C.RICHNESS_MAX}"
    return _item("richness", points, C.RICHNESS_MAX, reason[0].upper() + reason[1:],
                 test_rows=len(tests), measurements=len(measurements))


# --- notes, scoring, ranking -----------------------------------------------------------------

def notes_for(record: dict, scenario_key: str) -> list[str]:
    scenario = C.SCENARIOS[scenario_key]
    p = record.get("pressure_psi_range")
    notes = [f"Tested at {_fmt_range(p)} psi; scenario is {_fmt(scenario['pressure_psi'])} psi" if p
             else "Pressure not reported"]
    if record.get("gravity") == "partial_mimic":
        notes.append("Electric field used to mimic partial gravity — closest PSI data to Moon gravity")
    if scenario_key in C.PARTIAL_GRAVITY_SCENARIOS:
        notes.append("No real partial-gravity combustion data exists yet (LUCI, FM2 planned)")
    if record.get("extraction_confidence") == "llm_unchecked":
        notes.append("Some fields AI-extracted, not yet hand-checked")
    return notes


def callouts_for(record: dict, scenario_key: str) -> list[str]:
    """Pinned-card flags for the app (never scored)."""
    if record.get("gravity") == "partial_mimic" and scenario_key in C.PARTIAL_GRAVITY_SCENARIOS:
        return [C.PARTIAL_GRAVITY_MIMIC_CALLOUT]
    return []


def score_investigation(record: dict, scenario_key: str, focus: str = "all", ventilation: str | None = None,
                        placeholders: frozenset = frozenset()) -> dict:
    _validate(scenario_key, focus, ventilation)
    scenario = C.SCENARIOS[scenario_key]
    ventilation = ventilation or scenario["ventilation"]
    pid = record["psi_id"]
    breakdown = [
        score_oxygen(record.get("o2_percent_range"), scenario["o2_percent"]),
        score_flow(record.get("airflow_cm_s_range"), ventilation),
        score_material(record.get("fuel_phase"), record.get("fuels") or [], (pid, "fuel_phase") in placeholders),
        score_pillars(record.get("pillars") or [], focus),
        score_richness(record.get("tests") or [], record.get("measurements") or []),
    ]
    return {"psi_id": pid, "acronym": record.get("acronym"), "title": record.get("title"),
            "total": round(sum(b["points"] for b in breakdown), 1), "breakdown": breakdown,
            "matches_focus": focus == "all" or focus in (record.get("pillars") or []),
            "notes": notes_for(record, scenario_key), "callouts": callouts_for(record, scenario_key)}


def _psi_number(psi_id: str) -> tuple:
    tail = psi_id.split("-")[-1]
    return (int(tail), psi_id) if tail.isdigit() else (float("inf"), psi_id)


def rank(records: list[dict], scenario_key: str, focus: str = "all", ventilation: str | None = None,
         placeholders: frozenset = frozenset()) -> list[dict]:
    """Scored records, best first: (single-pillar focus) investigations covering it first, then
    total, then data richness, then PSI ID (numeric order). Scores themselves are never changed."""
    scored = [score_investigation(r, scenario_key, focus, ventilation, placeholders) for r in records]
    return sorted(scored, key=lambda s: (not s["matches_focus"], -s["total"], -s["breakdown"][4]["points"],
                                         _psi_number(s["psi_id"])))


def load_inputs(processed_dir: Path = PROCESSED) -> tuple[list[dict], frozenset]:
    """Records + {(psi_id, field)} whose values are placeholders (to be treated as unknown)."""
    records = json.loads((processed_dir / "investigations.json").read_text(encoding="utf-8"))
    prov_path = processed_dir / "provenance.json"
    provenance = json.loads(prov_path.read_text(encoding="utf-8")) if prov_path.exists() else {}
    placeholders = frozenset((pid, field) for pid, fields in provenance.items() for field, p in fields.items()
                             if isinstance(p, dict) and p.get("placeholder") is True)
    return records, placeholders


def format_table(ranked: list[dict], top: int | None = None) -> str:
    lines = ["| rank | PSI ID | acronym | total | A O2 | B flow | C material | D pillars | E data | focus |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for i, s in enumerate(ranked[:top], 1):
        pts = " | ".join(_fmt(b["points"]) for b in s["breakdown"])
        group = "✓" if s["matches_focus"] else "other"
        lines.append(f"| {i} | {s['psi_id']} | {s['acronym']} | {_fmt(s['total'])} | {pts} | {group} |")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> list[dict]:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--scenario", default="moon_base", choices=sorted(C.SCENARIOS))
    parser.add_argument("--focus", default="all", choices=C.FOCUSES)
    parser.add_argument("--ventilation", choices=C.VENTILATIONS, help="default: the scenario's own")
    parser.add_argument("--top", type=int, default=None)
    args = parser.parse_args(argv)
    records, placeholders = load_inputs()
    ranked = rank(records, args.scenario, args.focus, args.ventilation, placeholders)
    print(format_table(ranked, args.top))
    return ranked


if __name__ == "__main__":
    main()
