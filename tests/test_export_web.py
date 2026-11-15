"""Tests for scripts/export_web.py (offline). Run: pytest -q"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import export_web as E  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RECORDS = json.loads((ROOT / "data" / "processed" / "investigations.json").read_text(encoding="utf-8"))
IDS = {r["psi_id"] for r in RECORDS}


def test_export_rankings_24_files_each_with_all_24(tmp_path):
    rankings = E.export_rankings(tmp_path)
    files = sorted((tmp_path / "rankings").glob("*.json"))
    assert len(files) == len(rankings) == 24
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        assert path.stem == f"{data['scenario']}__{data['focus']}__{data['ventilation']}"
        assert {r["psi_id"] for r in data["results"]} == IDS and len(data["results"]) == 24


def test_rankings_are_deterministic(tmp_path):
    E.export_rankings(tmp_path / "a")
    E.export_rankings(tmp_path / "b")
    for path in (tmp_path / "a" / "rankings").glob("*.json"):
        assert path.read_bytes() == (tmp_path / "b" / "rankings" / path.name).read_bytes()


def test_contract_validation():
    assert all(E.validate_record(r) == [] for r in RECORDS)
    bad = {**RECORDS[0], "fuel_phase": "plasma", "o2_percent_range": [30, 21]}
    assert len(E.validate_record(bad)) == 2
    assert E.validate_record({k: v for k, v in RECORDS[0].items() if k != "doi"})


def test_explanations_offline_and_cached(tmp_path, monkeypatch):
    monkeypatch.setattr(E, "INTERIM", tmp_path / "interim")  # empty cache, no LLM -> offline text
    rankings = E.export_rankings(tmp_path)
    modes = E.export_explanations(tmp_path, rankings, use_llm=False)
    assert modes == {"llm": 0, "offline": 24}
    data = json.loads((tmp_path / "explanations.json").read_text(encoding="utf-8"))
    assert len(data) == 24 and all(v["top3"][0]["psi_id"] in v["explanation"] for v in data.values())


def test_summary_fallback_without_llm(tmp_path, monkeypatch):
    monkeypatch.setattr(E, "INTERIM", tmp_path)
    text = "Short. The Mir fire started in an oxygen generator on the station. The crew put it out quickly and safely."
    result = E.summarize({"id": "x", "title": "Mir"}, text, use_llm=False)
    assert result["summary_mode"] == "first_sentences"
    assert result["summary"].startswith("The Mir fire started")


def test_exported_web_data_is_complete():
    out = ROOT / "web" / "data"
    for name in ("investigations.json", "provenance.json", "scenarios.json", "explanations.json",
                 "demo_answers.json", "rag_index.json", "rag_eval.json", "rag_config.json", "rag_prompt.md",
                 "sources.json", "rubric.md", "meta.json"):
        assert (out / name).exists(), name
    assert len(list((out / "rankings").glob("*.json"))) == 24
    assert (out / "rag_config.json").read_bytes() == (ROOT / "rag" / "config.json").read_bytes()
    assert (out / "rag_prompt.md").read_bytes() == (ROOT / "rag" / "prompt.md").read_bytes()
    sources = json.loads((out / "sources.json").read_text(encoding="utf-8"))
    assert len(sources) == 10 and all(s.get("summary") for s in sources if s["type"] == "text")


# --- data explorer -----------------------------------------------------------------------------

def test_text_o2_reads_only_cells_that_mention_o2():
    from scripts.export_web import text_o2
    assert text_o2("~30% and ~21% O2 with He") == [30.0, 21.0]
    assert text_o2("50% C2H4 with N2") == []


def test_explorer_rows_trace_to_csv_columns():
    from scripts.export_web import explorer_rows
    records = json.loads((ROOT / "data" / "processed" / "investigations.json").read_text(encoding="utf-8"))
    data = explorer_rows(records)
    assert len(data["rows"]) == sum(len(r["tests"]) for r in records)
    saffire = [r for r in data["rows"] if r["psi_id"] == "PSI-98" and r["o2"]]
    assert saffire and all(21 <= r["o2"][0] <= r["o2"][1] <= 22 for r in saffire)
    same_r = data["tables"]["PSI-101_Experimental table_SAME-R.csv"]
    assert same_r["columns"]["airflow"] == "Inlet velocity (cm/s)"
    for table in data["tables"].values():  # a value is only reported with the column it came from
        rows = [r for r in data["rows"] if r["table"] in data["tables"] and data["tables"][r["table"]] is table]
        for kind in ("o2", "pressure", "airflow"):
            if table["columns"][kind] is None:
                assert all(r[kind] is None for r in rows)
