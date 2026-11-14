"""Gemini extraction of text-derived fields, with verbatim-quote checking and a per-ID cache.

The model only sees PSI text fields + CSV headers + up to 5 rows. Every value it returns must
come with a quote that literally appears in that input; anything else is rejected.
Raw model output is cached in data/interim/llm/<PSI-ID>.json and reused unless refresh=True.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "data" / "interim" / "llm"
DEFAULT_MODEL = "gemini-3.6-flash"
TEXT_FIELDS = ("title", "investigationAcronym", "objective", "approach", "hypothesis",
               "researchImpacts", "description", "subResearchArea", "projectType", "experimentHardware")
MAX_ROWS = 5
MAX_FUEL_VALUES = 60
MIN_QUOTE_CHARS = 8
DELAY_S = 1.0
RETRY_BACKOFF_S = (5, 15)

NOT_REPORTED = "not reported"
# field -> type: "phase" | "pillars" | "list" | "text"
LLM_FIELDS = {"fuel_phase": "phase", "pillars": "pillars", "fuels": "list", "measurements": "list",
              "objective_summary": "text", "key_findings": "text", "earth_applications": "text"}


class Quoted(BaseModel):
    value: str
    quote: str


class QuotedPhase(BaseModel):
    value: Literal["solid", "liquid_droplet", "gas", "mixed", "not reported"]
    quote: str


class QuotedPillar(BaseModel):
    value: Literal["prevention", "detection", "suppression"]
    quote: str


class Extraction(BaseModel):
    fuel_phase: QuotedPhase
    pillars: list[QuotedPillar]
    fuels: list[Quoted]
    measurements: list[Quoted]
    objective_summary: Quoted
    key_findings: Quoted
    earth_applications: Quoted


PROMPT = """You extract facts about one NASA microgravity combustion investigation for a fire-safety
dashboard. Use ONLY the INPUT below. Do not add outside knowledge. Do not guess.

For every value, give "quote": a short passage (one sentence or less) copied EXACTLY, character
for character, from the INPUT that supports the value. If the INPUT does not support a value, use
"not reported" (for text / fuel_phase) or an empty list, with quote "".

Fields:
- fuel_phase: physical state of what burns: solid | liquid_droplet | gas | mixed (several phases).
- pillars: fire-safety pillars the investigation informs, only these values: prevention
  (ignition, material flammability limits, flame spread), detection (smoke/aerosol/dust sensing),
  suppression (extinguishment, diluents, suppressants). Only include a pillar the text supports.
- fuels: each distinct fuel or sample material burned, with shape/size if stated (e.g. "SIBAL fabric,
  0.94 m x 0.4 m"). Use the "all values of ..." lists so no fuel is missed; merge near-duplicates
  (e.g. "PMMA 1 mm thick" and "PMMA 2 mm thick" -> "PMMA slabs, 1-2 mm thick"). Skip entries that are
  not fuels (calibration runs, flow-visualization tests). For a fuel from such a list, quote its whole line.
- measurements: each sensor or measurement type (e.g. "thermocouples", "video", "radiometers").
- objective_summary: at most 2 plain-English sentences on what the investigation set out to do.
- key_findings: results the text explicitly states (1-3 sentences); "not reported" if it states none.
- earth_applications: benefits on Earth only if the text mentions them; else "not reported".

INPUT
{input}
"""


def build_input(investigation: dict, tables: list[tuple[str, list[str], list[dict[str, str]]]]) -> str:
    """The exact text the model sees (and the haystack quotes are checked against)."""
    parts = []
    for key in TEXT_FIELDS:
        value = investigation.get(key)
        if isinstance(value, list):
            value = "; ".join(map(str, value))
        if value:
            parts.append(f"[{key}]\n{str(value).strip()}")
    for file_name, headers, rows in tables:
        lines = [", ".join(headers)] + [", ".join(r.get(h, "") for h in headers) for r in rows[:MAX_ROWS]]
        parts.append(f"[experimental table: {file_name}]\n" + "\n".join(lines))
        # The first rows can miss fuels (FLEX's first 5 rows are all methanol), so list every
        # distinct value of fuel/material columns too, one "column: value" line each.
        for header in filter(is_fuel_column, headers):
            values = list(dict.fromkeys(r.get(header, "").strip() for r in rows if r.get(header, "").strip()))
            if values:
                listed = "\n".join(f"{header}: {v}" for v in values[:MAX_FUEL_VALUES])
                parts.append(f"[all values of '{header}' in {file_name}]\n{listed}")
    return "\n\n".join(parts)


def is_fuel_column(header: str) -> bool:
    """Columns naming what burned ('Fuel', 'Fuel Bottle', 'Sample Material'), not fuel amounts or rates."""
    h = header.lower()
    if not re.search(r"fuel|material", h):
        return False
    return not re.search(r"rate|mfc|conc|xfuel|mfuel|mg/s|sccm", h)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def quote_ok(quote: str, source: str) -> bool:
    q = _norm(quote or "")
    return len(q) >= MIN_QUOTE_CHARS and q in _norm(source)


def verify(raw: dict, source: str) -> tuple[dict, dict, list[str]]:
    """Model output -> (values, provenance, rejected). Unsupported values become empty/"not reported"."""
    values, prov, rejected = {}, {}, []
    for name, kind in LLM_FIELDS.items():
        item = raw.get(name)
        if kind in ("list", "pillars"):
            kept, quotes = [], []
            for entry in item or []:
                if quote_ok(entry.get("quote", ""), source) and entry.get("value"):
                    if entry["value"] not in kept:
                        kept.append(entry["value"])
                        quotes.append(entry["quote"])
                else:
                    rejected.append(f"{name}: {entry.get('value')!r} (quote not found in PSI text)")
            values[name] = kept
            prov[name] = {"source": "llm", "quotes": quotes} if kept else {"source": "llm:none_supported"}
            continue
        value = (item or {}).get("value") or NOT_REPORTED
        if value == NOT_REPORTED:
            values[name], prov[name] = NOT_REPORTED, {"source": "llm:not_reported"}
        elif quote_ok(item.get("quote", ""), source):
            values[name], prov[name] = value, {"source": "llm", "quote": item["quote"]}
        else:
            values[name], prov[name] = NOT_REPORTED, {"source": "llm:quote_rejected"}
            rejected.append(f"{name}: {value!r} (quote not found in PSI text)")
    return values, prov, rejected


def model_name() -> str:
    return os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL


def call_gemini(text: str) -> dict:
    from google import genai
    from google.genai import errors, types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    config = types.GenerateContentConfig(response_mime_type="application/json", response_schema=Extraction)
    for attempt in range(len(RETRY_BACKOFF_S) + 1):
        time.sleep(DELAY_S if attempt == 0 else RETRY_BACKOFF_S[attempt - 1])
        try:
            response = client.models.generate_content(
                model=model_name(), contents=PROMPT.format(input=text), config=config)
            return json.loads(response.text)
        except errors.APIError as exc:
            retryable = exc.code == 429 or (exc.code or 0) >= 500
            if not retryable or attempt == len(RETRY_BACKOFF_S):
                raise
            print(f"    Gemini HTTP {exc.code} - retrying")
    raise RuntimeError("unreachable")


def extract(psi_id: str, text: str, refresh: bool = False) -> dict:
    """Cached raw model output for one investigation."""
    path = CACHE_DIR / f"{psi_id}.json"
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))["output"]
    print(f"  calling {model_name()} for {psi_id}")
    output = call_gemini(text)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"psi_id": psi_id, "model": model_name(), "output": output},
                               indent=2, ensure_ascii=False), encoding="utf-8")
    return output
