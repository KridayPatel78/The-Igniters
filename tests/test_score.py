"""Tests for rank/score.py on synthetic records (no network, no LLM). Run: pytest -q"""
import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rank import score as S  # noqa: E402


def make(**overrides) -> dict:
    record = {
        "psi_id": "PSI-1", "acronym": "TEST", "title": "Test investigation", "fuel_phase": "gas",
        "fuels": ["methane"], "o2_percent_range": [21, 21], "pressure_psi_range": None,
        "airflow_cm_s_range": [20, 20], "gravity": "microgravity", "pillars": ["prevention"],
        "measurements": ["video"], "tests": [{"a": "1"}], "extraction_confidence": "checked",
    }
    record.update(overrides)
    return record


def points(result: dict, criterion: str) -> float:
    return next(b["points"] for b in result["breakdown"] if b["criterion"] == criterion)


# --- A. oxygen -------------------------------------------------------------------------------

def test_oxygen_inside_range_full_points():
    assert S.score_oxygen([21, 40], 30)["points"] == 35


def test_oxygen_30_or_more_points_away_is_zero():
    assert S.score_oxygen([21, 21], 51)["points"] == 0
    assert S.score_oxygen([21, 21], 100)["points"] == 0


def test_oxygen_linear_and_reason():
    item = S.score_oxygen([21.5, 21.7], 30)
    assert item["points"] == 25.3
    assert "21.5–21.7% O₂" in item["reason"] and "8.3 points away" in item["reason"]


def test_oxygen_not_reported_zero():
    item = S.score_oxygen(None, 21)
    assert item["points"] == 0 and "not reported" in item["reason"]


# --- B. flow ---------------------------------------------------------------------------------

@pytest.mark.parametrize("airflow, ventilation, expected", [
    ([20, 20], "ventilated", 15), ([0, 0], "quiescent", 15),
    ([20, 20], "quiescent", 5), ([0, 0], "ventilated", 5),
    (None, "ventilated", 0), (None, "quiescent", 0),
])
def test_flow(airflow, ventilation, expected):
    assert S.score_flow(airflow, ventilation)["points"] == expected


def test_ventilation_argument_overrides_scenario_default():
    record = make(airflow_cm_s_range=[0, 0])
    assert points(S.score_investigation(record, "iss_cabin"), "flow") == 5
    assert points(S.score_investigation(record, "iss_cabin", ventilation="quiescent"), "flow") == 15


# --- C. material -----------------------------------------------------------------------------

def test_material_solid_with_habitat_material_capped_at_20():
    item = S.score_material("solid", ["Nomex fabric", "PMMA slabs"])
    assert item["points"] == 20 and "Nomex" in item["reason"] and "PMMA" in item["reason"]


def test_material_gas_no_keyword():
    assert S.score_material("gas", ["methane"])["points"] == 6


def test_material_placeholder_is_unknown_even_if_mixed():
    assert S.score_material("mixed", ["dust"], phase_is_placeholder=True)["points"] == 0
    assert S.score_material("mixed", ["dust"])["points"] == 10


def test_placeholders_from_load_inputs_are_applied():
    record = make(psi_id="PSI-7", fuel_phase="mixed", fuels=["dust"])
    assert points(S.score_investigation(record, "iss_cabin"), "material") == 10
    scored = S.score_investigation(record, "iss_cabin", placeholders=frozenset({("PSI-7", "fuel_phase")}))
    assert points(scored, "material") == 0


# --- D. pillars ------------------------------------------------------------------------------

@pytest.mark.parametrize("pillars, focus, expected", [
    ([], "all", 0), (["prevention"], "all", 14), (["prevention", "detection"], "all", 17),
    (["prevention", "detection", "suppression"], "all", 20),
    (["detection"], "detection", 20), (["prevention"], "detection", 6), ([], "detection", 0),
    (["suppression", "prevention"], "suppression", 20),
])
def test_pillars(pillars, focus, expected):
    assert S.score_pillars(pillars, focus)["points"] == expected


# --- E. richness -----------------------------------------------------------------------------

def test_richness_cap_and_parts():
    assert S.score_richness([{"a": 1}], ["m"] * 9)["points"] == 10
    assert S.score_richness([], ["m"] * 2)["points"] == 2
    assert S.score_richness([{"a": 1}], [])["points"] == 5


# --- whole score -----------------------------------------------------------------------------

def test_total_is_sum_and_every_reason_present():
    result = S.score_investigation(make(), "moon_base")
    assert result["total"] == round(sum(b["points"] for b in result["breakdown"]), 1)
    assert [b["criterion"] for b in result["breakdown"]] == ["oxygen", "flow", "material", "pillars", "richness"]
    assert all(b["reason"].strip() for b in result["breakdown"])
    assert all(0 <= b["points"] <= b["max"] for b in result["breakdown"])


def test_deterministic():
    records = [make(psi_id=f"PSI-{i}", o2_percent_range=[i, i]) for i in (5, 30, 21)]
    snapshot = copy.deepcopy(records)
    assert S.rank(records, "moon_base") == S.rank(records, "moon_base")
    assert records == snapshot  # inputs not mutated


def test_tie_identical_scores_broken_by_numeric_psi_id():
    ranked = S.rank([make(psi_id="PSI-20"), make(psi_id="PSI-3")], "iss_cabin")
    assert ranked[0]["total"] == ranked[1]["total"]
    assert [r["psi_id"] for r in ranked] == ["PSI-3", "PSI-20"]  # 3 before 20, not string order


def test_tie_broken_by_data_richness_first():
    rich = make(psi_id="PSI-9", measurements=["a", "b", "c"])                          # D 14 + E 8 = 22
    poor = make(psi_id="PSI-8", measurements=[], pillars=["prevention", "detection"])  # D 17 + E 5 = 22
    ranked = S.rank([poor, rich], "iss_cabin")
    assert ranked[0]["total"] == ranked[1]["total"]
    assert [r["psi_id"] for r in ranked] == ["PSI-9", "PSI-8"]  # richer wins despite higher PSI number


@pytest.mark.parametrize("kwargs", [{"scenario_key": "venus"}, {"scenario_key": "iss_cabin", "focus": "fun"},
                                    {"scenario_key": "iss_cabin", "ventilation": "windy"}])
def test_invalid_inputs_raise(kwargs):
    with pytest.raises(ValueError):
        S.score_investigation(make(), **kwargs)


# --- behaviour -------------------------------------------------------------------------------

def test_moon_base_prefers_30_percent_o2():
    at30, at21 = make(psi_id="PSI-30", o2_percent_range=[30, 30]), make(psi_id="PSI-21", o2_percent_range=[21, 21])
    assert [r["psi_id"] for r in S.rank([at21, at30], "moon_base")] == ["PSI-30", "PSI-21"]


def test_spacesuit_prefers_higher_o2():
    high, low = make(psi_id="PSI-2", o2_percent_range=[40, 85]), make(psi_id="PSI-1", o2_percent_range=[21, 21])
    assert S.rank([low, high], "spacesuit")[0]["psi_id"] == "PSI-2"


def test_detection_focus_prefers_detection_record():
    det, prev = make(psi_id="PSI-2", pillars=["detection"]), make(psi_id="PSI-1", pillars=["prevention"])
    assert S.rank([prev, det], "moon_base", focus="detection")[0]["psi_id"] == "PSI-2"


def test_notes():
    notes = S.score_investigation(make(gravity="partial_mimic", extraction_confidence="llm_unchecked",
                                       pressure_psi_range=[7.3, 44]), "moon_base")["notes"]
    assert "Tested at 7.3–44 psi; scenario is 10.2 psi" in notes
    assert any("mimic partial gravity" in n for n in notes)
    assert any("LUCI, FM2" in n for n in notes)
    assert any("not yet hand-checked" in n for n in notes)
    assert S.score_investigation(make(), "iss_cabin")["notes"] == ["Pressure not reported"]


def test_real_data_loads_and_ranks():
    records, placeholders = S.load_inputs()
    assert len(records) == 24 and ("PSI-47", "fuel_phase") in placeholders
    ranked = S.rank(records, "moon_base")
    assert len(ranked) == 24 and ranked[0]["total"] >= ranked[-1]["total"]


# --- Step 4: evidence-only flow, focus grouping, callouts -------------------------------------

def test_flow_unknown_scores_zero_with_reason():
    item = S.score_flow(None, "ventilated")
    assert item["points"] == 0 and "no points without evidence" in item["reason"]
    assert S.score_flow([20, 20], "quiescent")["points"] > item["points"]  # a known mismatch beats no data


def test_focus_groups_ranking_without_changing_scores():
    det = make(psi_id="PSI-2", pillars=["detection"], o2_percent_range=None, tests=[], measurements=[])
    prev = make(psi_id="PSI-1", pillars=["prevention"], o2_percent_range=[30, 30])
    ranked = S.rank([prev, det], "moon_base", focus="detection")
    assert [r["psi_id"] for r in ranked] == ["PSI-2", "PSI-1"]
    assert ranked[0]["total"] < ranked[1]["total"]  # grouped first despite the lower score
    assert [r["matches_focus"] for r in ranked] == [True, False]
    assert ranked[0]["total"] == S.score_investigation(det, "moon_base", focus="detection")["total"]


def test_focus_all_sorts_by_total_and_everything_matches():
    det = make(psi_id="PSI-2", pillars=["detection"], o2_percent_range=None)
    prev = make(psi_id="PSI-1", pillars=["prevention"], o2_percent_range=[30, 30])
    ranked = S.rank([det, prev], "moon_base")
    assert [r["psi_id"] for r in ranked] == ["PSI-1", "PSI-2"] and all(r["matches_focus"] for r in ranked)


@pytest.mark.parametrize("scenario, expected", [("moon_base", ["closest_to_partial_gravity"]),
                                                ("mars_habitat", ["closest_to_partial_gravity"]),
                                                ("iss_cabin", []), ("spacesuit", [])])
def test_partial_gravity_callout(scenario, expected):
    assert S.score_investigation(make(gravity="partial_mimic"), scenario)["callouts"] == expected
    assert S.score_investigation(make(), scenario)["callouts"] == []


def test_real_data_focus_groups():
    records, placeholders = S.load_inputs()
    det = S.rank(records, "moon_base", focus="detection", placeholders=placeholders)
    top = {r["psi_id"] for r in det if r["matches_focus"]}
    assert {"PSI-102", "PSI-101", "PSI-47"} <= top
    sup = S.rank(records, "moon_base", focus="suppression", placeholders=placeholders)
    top = {r["psi_id"] for r in sup if r["matches_focus"]}
    assert {"PSI-69", "PSI-68"} <= top
    assert not top & {"PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"}
    efield = next(r for r in S.rank(records, "moon_base") if r["psi_id"] == "PSI-22")
    assert efield["callouts"] == ["closest_to_partial_gravity"]
