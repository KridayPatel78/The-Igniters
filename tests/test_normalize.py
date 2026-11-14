"""Offline tests for extract/ (no network, no API key). Run: pytest -q"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extract import csv_fields as cf  # noqa: E402
from extract import llm, normalize  # noqa: E402


# --- number parsing --------------------------------------------------------------------------

@pytest.mark.parametrize("cell, expected", [
    ("21.5 - 21.7", [21.5, 21.7]),
    ("~ 21.5", [21.5]),
    ("0.21", [0.21]),
    ("", []),
    ("-", []),
    ("N/A", []),
    ("LOW O2", []),
    ("21; 26.5; 34", [21, 26.5, 34]),
    ("20 cm/s", [20]),
    ("-5.92", [-5.92]),
])
def test_parse_numbers(cell, expected):
    assert cf.parse_numbers(cell) == expected


def test_o2_fraction_scaled_to_percent():
    rows = [{"Oxygen": "0.21"}, {"Oxygen": "0.17"}]
    assert cf.find_range("o2", [("t.csv", ["Oxygen"], rows)]).value == [17.0, 21.0]
    assert cf.o2_is_fraction("Oxygen Mole Fraction", [21.0])
    assert not cf.o2_is_fraction("Percent O2", [21.5])


def test_impossible_o2_dropped_and_noted():
    rows = [{"Oxygen Conc (percent)": "2100%"}, {"Oxygen Conc (percent)": "21; 34"}]
    result = cf.find_range("o2", [("t.csv", ["Oxygen Conc (percent)"], rows)])
    assert result.value == [21.0, 34.0] and result.notes


# --- units -----------------------------------------------------------------------------------

@pytest.mark.parametrize("value, unit, psi", [
    (1, "atm", 14.6959), (100, "kPa", 14.5038), (1, "bar", 14.5038),
    (760, "mmHg", 14.6960), (760, "torr", 14.6960), (10, "psia", 10),
])
def test_convert_pressure(value, unit, psi):
    assert cf.convert_pressure(value, unit) == pytest.approx(psi, rel=1e-4)


@pytest.mark.parametrize("value, unit, cm_s", [(20, "cm/s", 20), (50, "mm/s", 5), (0.2, "m/s", 20)])
def test_convert_airflow(value, unit, cm_s):
    assert cf.convert_airflow(value, unit) == pytest.approx(cm_s)


def test_unclear_unit_gives_none():
    assert cf.convert_pressure(1, None) is None
    assert cf.convert_airflow(1, "furlongs") is None
    rows = [{"Air display": "10"}]
    result = cf.find_range("airflow", [("t.csv", ["Air display"], rows)])
    assert result.value is None and "unit unclear" in result.notes[0]


def test_units_read_from_cells_and_headers():
    rows = [{"Pressure": "0.5 atm"}, {"Pressure": "2 atm"}]
    assert cf.find_range("pressure", [("t.csv", ["Pressure"], rows)]).value == [7.3479, 29.3918]
    rows = [{"approx p (bar)": "1.0"}]
    assert cf.find_range("pressure", [("t.csv", ["approx p (bar)"], rows)]).value == [14.5038, 14.5038]


# --- column matching -------------------------------------------------------------------------

@pytest.mark.parametrize("header, is_o2", [
    ("Percent O2", True), ("XO2 (init)", True), ("Oxygen Mole Fraction", True),
    ("CO2 (ppm)", False), ("Initial CO2 % by vol", False),
    ("mO2 (mg/s)", False), ("O2 flow rate (mg/s)", False),
])
def test_o2_column_matching(header, is_o2):
    assert cf.is_o2_column(header) is is_o2


@pytest.mark.parametrize("header, is_airflow", [
    ("Air Flow (cm/s)", True), ("Flow Velocity (cm/s)", True),
    ("Fuel Rate (mg/s)", False), ("mtot (mg/s)", False), ("Fuel Rate (sccm)", False),
])
def test_airflow_column_matching(header, is_airflow):
    assert cf.is_airflow_column(header) is is_airflow


def test_final_columns_ignored_when_initial_exists():
    headers = ["XO2 (init)", "XO2 (final)"]
    rows = [{"XO2 (init)": "0.21", "XO2 (final)": "0.05"}]
    result = cf.find_range("o2", [("t.csv", headers, rows)])
    assert result.value == [21.0, 21.0] and result.columns == ["csv:t.csv:XO2 (init)"]


# --- end to end on the real files (no LLM) ---------------------------------------------------

def test_psi98_no_llm_matches_sample():
    rec, prov = normalize.build_record("PSI-98", use_llm=False, checked=set())
    assert set(rec) == set(normalize.CONTRACT_KEYS)
    assert rec["o2_percent_range"] == [21.5, 21.7]
    assert rec["airflow_cm_s_range"] == [20, 20]
    assert rec["pressure_psi_range"] is None
    assert len(rec["tests"]) == 4 and rec["tests"][0]["Percent O2"] == "21.5 - 21.7"
    assert rec["fuel_phase"] == "solid" and rec["pillars"] == ["prevention"]
    assert rec["gravity"] == "microgravity"
    assert rec["doi"] == "10.60555/0t15-1z43"
    assert prov["o2_percent_range"] == ["csv:PSI-98_Experimental table_SAFFIRE-1.csv:Percent O2"]
    assert rec["extraction_confidence"] == "llm_unchecked"


def test_seeds_flex_and_efield():
    flex, _ = normalize.build_record("PSI-69", use_llm=False, checked=set())
    assert flex["pillars"] == ["suppression"] and flex["fuel_phase"] == "liquid_droplet"
    efield, _ = normalize.build_record("PSI-22", use_llm=False, checked=set())
    assert efield["gravity"] == "partial_mimic"


def test_multi_table_rows_tagged():
    rec, _ = normalize.build_record("PSI-10", use_llm=False, checked=set())
    assert {row["_table"] for row in rec["tests"]} == {
        "PSI-10_Experimental table_Flame Design_Inverse Flame.csv",
        "PSI-10_Experimental table_Flame Design_Normal Flame.csv"}


# --- LLM quote verification, overrides, checked IDs ------------------------------------------

SOURCE = "[objective]\nDetermine how rapidly a large scale fire grows in low-gravity."


def _raw(**fields):
    base = {"fuel_phase": {"value": "not reported", "quote": ""}, "pillars": [], "fuels": [],
            "measurements": [], "objective_summary": {"value": "not reported", "quote": ""},
            "key_findings": {"value": "not reported", "quote": ""},
            "earth_applications": {"value": "not reported", "quote": ""}}
    return {**base, **fields}


def test_quote_verification():
    assert llm.quote_ok("how rapidly a large   scale fire\ngrows", SOURCE)
    assert not llm.quote_ok("fire spreads faster in microgravity", SOURCE)
    assert not llm.quote_ok("", SOURCE)


def test_verify_rejects_invented_quote():
    raw = _raw(objective_summary={"value": "Measure fire growth.", "quote": "how rapidly a large scale fire grows"},
               key_findings={"value": "Fires grew fast.", "quote": "fires grew twice as fast"},
               fuels=[{"value": "cotton", "quote": "made of cotton"}])
    values, prov, rejected = llm.verify(raw, SOURCE)
    assert values["objective_summary"] == "Measure fire growth." and prov["objective_summary"]["source"] == "llm"
    assert values["key_findings"] == "not reported" and values["fuels"] == []
    assert len(rejected) == 2


@pytest.fixture
def fake_llm(monkeypatch):
    raw = _raw(objective_summary={"value": "LLM summary.", "quote": "The objectives of this investigation"})
    monkeypatch.setattr(llm, "extract", lambda psi_id, text, refresh=False: raw)


def test_override_beats_llm(tmp_path, fake_llm):
    (tmp_path / "PSI-98.json").write_text(json.dumps({"objective_summary": "Human text."}), encoding="utf-8")
    rec, prov = normalize.build_record("PSI-98", use_llm=True, overrides_dir=tmp_path, checked=set())
    assert rec["objective_summary"] == "Human text." and prov["objective_summary"] == "override"
    rec, prov = normalize.build_record("PSI-98", use_llm=True, overrides_dir=tmp_path / "none", checked=set())
    assert rec["objective_summary"] == "LLM summary." and prov["objective_summary"]["source"] == "llm"


def test_override_rejects_unknown_keys(tmp_path):
    (tmp_path / "PSI-98.json").write_text(json.dumps({"not_a_field": 1}), encoding="utf-8")
    with pytest.raises(ValueError):
        normalize.load_override("PSI-98", tmp_path)


def test_checked_ids_sets_confidence(tmp_path):
    checked_file = tmp_path / "checked_ids.txt"
    checked_file.write_text("# comment\nPSI-98  # verified by hand\n", encoding="utf-8")
    checked = normalize.read_checked(checked_file)
    assert checked == {"PSI-98"}
    rec, _ = normalize.build_record("PSI-98", use_llm=False, checked=checked)
    assert rec["extraction_confidence"] == "checked"


def test_override_source_note_goes_to_provenance(tmp_path):
    note = {"_source": "json:approach - Cygnus", "platform": "Cygnus resupply vehicle"}
    (tmp_path / "PSI-98.json").write_text(json.dumps(note), encoding="utf-8")
    rec, prov = normalize.build_record("PSI-98", use_llm=False, overrides_dir=tmp_path, checked=set())
    assert rec["platform"] == "Cygnus resupply vehicle" and "_source" not in rec
    assert prov["platform"] == {"source": "override", "quote": "json:approach - Cygnus"}


def test_saffire_platform_overrides_are_real():
    for psi_id in ("PSI-98", "PSI-100"):
        rec, prov = normalize.build_record(psi_id, use_llm=False, checked=set())
        assert rec["platform"].startswith("Cygnus") and prov["platform"]["source"] == "override"


@pytest.mark.parametrize("header, is_fuel", [
    ("Fuel", True), ("Fuel Bottle", True), ("Sample Material", True), ("Sample (Fuel Type)", True),
    ("Fuel Rate (sccm)", False), ("mfuel (mg/s)", False), ("Xfuel", False), ("Fuel conc. Range", False),
])
def test_fuel_column_matching(header, is_fuel):
    assert llm.is_fuel_column(header) is is_fuel


def test_llm_input_lists_every_fuel():
    tables = normalize.load_tables("PSI-69")
    text = llm.build_input({"title": "FLEX"}, tables)
    assert "Fuel: Methanol" in text and "Fuel: Heptane" in text


def test_unknown_fuel_phase_marked_placeholder():
    prov = json.loads((normalize.OUT_DIR / "provenance.json").read_text(encoding="utf-8"))
    placeholders = {pid for pid, p in prov.items() if normalize.is_placeholder(p["fuel_phase"])}
    assert placeholders == {"PSI-47", "PSI-115"}
    assert prov["PSI-60"]["fuel_phase"]["source"] == "override"
