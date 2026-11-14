"""Guards the Data contract in AGENTS.md. Run: pytest -q

Checks the sample file always, and the real investigations.json once it exists,
so nobody's branch silently changes the shape the other three depend on.
"""
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FILES = [p for p in [
    ROOT / "data" / "processed" / "investigations.sample.json",
    ROOT / "data" / "processed" / "investigations.json",
] if p.exists()]

REQUIRED_KEYS = {
    "psi_id", "acronym", "title", "doi", "platform", "hardware", "fuel_phase", "fuels",
    "o2_percent_range", "pressure_psi_range", "airflow_cm_s_range", "gravity", "pillars",
    "measurements", "objective_summary", "key_findings", "earth_applications", "tests",
    "source_urls", "extraction_confidence",
}
FUEL_PHASES = {"solid", "liquid_droplet", "gas", "mixed"}
GRAVITY = {"microgravity", "normal", "partial_mimic"}
PILLARS = {"prevention", "detection", "suppression"}
CONFIDENCE = {"checked", "llm_unchecked"}


def _records():
    for path in FILES:
        for rec in json.loads(path.read_text(encoding="utf-8")):
            yield pytest.param(rec, id=f"{path.name}:{rec.get('psi_id')}")


@pytest.mark.parametrize("rec", list(_records()))
def test_record_matches_contract(rec):
    assert set(rec) == REQUIRED_KEYS, f"keys differ: {set(rec) ^ REQUIRED_KEYS}"
    assert rec["psi_id"].startswith("PSI-")
    assert rec["fuel_phase"] in FUEL_PHASES
    assert rec["gravity"] in GRAVITY
    assert set(rec["pillars"]) <= PILLARS
    assert rec["extraction_confidence"] in CONFIDENCE
    for key in ("o2_percent_range", "pressure_psi_range", "airflow_cm_s_range"):
        value = rec[key]
        assert value is None or (len(value) == 2 and value[0] <= value[1]), key
    assert isinstance(rec["tests"], list)
    assert rec["source_urls"], "every record needs at least one source URL"
