"""Offline tests for ingest/fetch_psi.py (requests is mocked, no network). Run: pytest -q"""
import json
import sys
from pathlib import Path
from unittest import mock

import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest import fetch_psi  # noqa: E402

CSV = b"Sample Number ,Material,Sample Thickness (cm)\nS1,SIBAL,0.025\n"
SIGNED = "https://signed.example/PSI-98.csv?X-Amz-Signature=secret"
TABLE = {"file_name": "PSI-98_Experimental table_SAFFIRE-1.csv", "version": 1}


def _resp(status=200, json_data=None, text="", content=b""):
    r = mock.Mock(status_code=status, text=text, content=content)
    r.json.return_value = json_data
    return r


@pytest.fixture
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_psi, "RAW_DIR", tmp_path)
    monkeypatch.setattr(fetch_psi.time, "sleep", lambda s: None)
    return tmp_path


def _session(*responses):
    session = mock.Mock()
    session.get.side_effect = list(responses)
    return session


def test_read_ids_real_file():
    ids = fetch_psi.read_ids()
    assert len(ids) == 24
    assert len(set(ids)) == 24
    assert all(i.startswith("PSI-") and "#" not in i for i in ids)
    assert "PSI-98" in ids and "PSI-142" in ids


def test_read_ids_comments_and_blanks(tmp_path):
    f = tmp_path / "ids.txt"
    f.write_text("# header\n\nPSI-1   # trailing comment  T\n  # indented comment\nPSI-2\n", encoding="utf-8")
    assert fetch_psi.read_ids(f) == ["PSI-1", "PSI-2"]


def test_full_flow_saves_json_and_csv(raw, capsys):
    inv = {"investigationAcronym": "SAFFIRE-I", "title": "Saffire", "doi": "10.x/y", "experimentalTable": [TABLE]}
    session = _session(_resp(json_data=inv), _resp(text=f' "{SIGNED}"\n'), _resp(content=CSV))

    rec = fetch_psi.fetch_one(session, "PSI-98", force=False)

    assert rec["json_ok"] and rec["errors"] == []
    assert rec["acronym"] == "SAFFIRE-I" and rec["doi"] == "10.x/y"
    assert rec["tables"] == [TABLE["file_name"]]
    assert json.loads((raw / "PSI-98.json").read_text(encoding="utf-8")) == inv
    assert (raw / "PSI-98" / TABLE["file_name"]).read_bytes() == CSV
    # Signed-URL step uses the right params; quoted URL is stripped before the second GET.
    link_call, csv_call = session.get.call_args_list[1:]
    assert link_call.args[0].endswith("/studies/PSI-98/download")
    assert link_call.kwargs["params"] == {"file": TABLE["file_name"], "version": 1, "redirect": "false"}
    assert csv_call.args[0] == SIGNED
    assert "signed.example" not in capsys.readouterr().out


def test_xml_error_body_rejected(raw):
    inv = {"experimentalTable": [TABLE]}
    error = b'<?xml version="1.0"?><Error><Code>AccessDenied</Code></Error>'
    session = _session(_resp(json_data=inv), _resp(text=SIGNED), _resp(content=error))

    rec = fetch_psi.fetch_one(session, "PSI-98", force=False)

    assert rec["tables"] == [] and len(rec["errors"]) == 1
    assert not (raw / "PSI-98" / TABLE["file_name"]).exists()
    assert "signed.example" not in rec["errors"][0]


@pytest.mark.parametrize("body", [b"<!DOCTYPE html><html>", b"  <html><body>404"])
def test_html_error_page_detected(body):
    assert fetch_psi.is_error_page(body)
    assert not fetch_psi.is_error_page(CSV)


def test_cached_files_skipped(raw):
    (raw / "PSI-98.json").write_text(json.dumps({"experimentalTable": [TABLE]}), encoding="utf-8")
    (raw / "PSI-98").mkdir()
    (raw / "PSI-98" / TABLE["file_name"]).write_bytes(CSV)
    session = _session()

    rec = fetch_psi.fetch_one(session, "PSI-98", force=False)

    session.get.assert_not_called()
    assert rec["json_ok"] and rec["tables"] == [TABLE["file_name"]]


def test_force_refetches(raw):
    (raw / "PSI-60.json").write_text("{}", encoding="utf-8")
    session = _session(_resp(json_data={"experimentalTable": []}))
    fetch_psi.fetch_one(session, "PSI-60", force=True)
    assert session.get.call_count == 1


@pytest.mark.parametrize("tables", [[], None])
def test_empty_experimental_table(raw, tables):
    session = _session(_resp(json_data={"title": "SPICE analysis", "experimentalTable": tables}))
    rec = fetch_psi.fetch_one(session, "PSI-60", force=False)
    assert rec["json_ok"] and rec["tables"] == [] and rec["errors"] == []
    assert session.get.call_count == 1


def test_no_retry_on_4xx(raw):
    session = _session(_resp(status=404))
    rec = fetch_psi.fetch_one(session, "PSI-999", force=False)
    assert not rec["json_ok"] and "HTTP 404" in rec["errors"][0]
    assert session.get.call_count == 1


def test_retries_5xx_and_timeouts_then_gives_up(raw):
    session = _session(_resp(status=503), requests.Timeout(), _resp(status=500))
    rec = fetch_psi.fetch_one(session, "PSI-10", force=False)
    assert not rec["json_ok"] and "HTTP 500" in rec["errors"][0]
    assert session.get.call_count == 3


def test_retry_then_success(raw):
    session = _session(requests.ConnectionError(), _resp(json_data={"experimentalTable": []}))
    rec = fetch_psi.fetch_one(session, "PSI-10", force=False)
    assert rec["json_ok"] and session.get.call_count == 2


def test_manifest_merges_partial_runs(raw):
    fetch_psi.write_manifest([{"psi_id": "PSI-1", "tables": []}])
    fetch_psi.write_manifest([{"psi_id": "PSI-2", "tables": ["a.csv"]}])
    manifest = json.loads((raw / "_manifest.json").read_text(encoding="utf-8"))
    assert [r["psi_id"] for r in manifest] == ["PSI-1", "PSI-2"]
