"""Export everything the website reads into web/data/ (Python is the data factory; the site never
re-scores).

Usage:
    python -m scripts.export_web              # uses cached LLM output; calls Gemini only for new items
    python -m scripts.export_web --no-llm     # deterministic explanations / summaries only

Writes: investigations.json, provenance.json, scenarios.json, rankings/<scenario>__<focus>__<ventilation>.json
(32 files), explanations.json, demo_answers.json, rag_index.json, rag_eval.json, rag_config.json,
rag_prompt.md, sources.json (with 2-sentence summaries), rubric.md, explorer.json (every test row with
O2 / pressure / airflow in common units), meta.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from itertools import product
from pathlib import Path
from typing import Callable

from rank import config as rank_config
from rank.score import load_inputs, rank

ROOT = Path(__file__).resolve().parents[1]
WEB_DATA = ROOT / "web" / "data"
PROCESSED = ROOT / "data" / "processed"
INTERIM = ROOT / "data" / "interim"

CONTRACT_KEYS = {
    "psi_id", "acronym", "title", "doi", "platform", "hardware", "fuel_phase", "fuels",
    "o2_percent_range", "pressure_psi_range", "airflow_cm_s_range", "gravity", "pillars",
    "measurements", "objective_summary", "key_findings", "earth_applications", "tests",
    "source_urls", "extraction_confidence",
}
ENUMS = {"fuel_phase": {"solid", "liquid_droplet", "gas", "mixed"},
         "gravity": {"microgravity", "normal", "partial_mimic"},
         "extraction_confidence": {"checked", "llm_unchecked"}}
PILLARS = {"prevention", "detection", "suppression"}


# --- helpers ---------------------------------------------------------------------------------

def write_json(path: Path, data) -> None:
    """Stable formatting so re-exports give clean diffs."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def copy(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)


def validate_record(rec: dict) -> list[str]:
    """Data-contract problems for one investigation (empty list = valid)."""
    problems = []
    if set(rec) != CONTRACT_KEYS:
        problems.append(f"keys differ: {sorted(set(rec) ^ CONTRACT_KEYS)}")
    for key, allowed in ENUMS.items():
        if rec.get(key) not in allowed:
            problems.append(f"{key}={rec.get(key)!r}")
    if not set(rec.get("pillars") or []) <= PILLARS:
        problems.append(f"pillars={rec.get('pillars')}")
    for key in ("o2_percent_range", "pressure_psi_range", "airflow_cm_s_range"):
        value = rec.get(key)
        if value is not None and not (len(value) == 2 and value[0] <= value[1]):
            problems.append(f"{key}={value}")
    if not str(rec.get("psi_id", "")).startswith("PSI-") or not rec.get("source_urls"):
        problems.append("psi_id / source_urls")
    return problems


def _cached_llm(folder: Path, generate: Callable[[str], str] | None) -> Callable[[str], str]:
    """Wrap a generator with a prompt-hash cache in data/interim/<folder>/ (committed)."""
    def cached(prompt: str) -> str:
        path = folder / f"{hashlib.sha256(prompt.encode('utf-8')).hexdigest()[:20]}.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))["output"]
        if generate is None:
            raise RuntimeError("LLM disabled")
        output = generate(prompt)
        write_json(path, {"model": os.environ.get("GEMINI_MODEL") or "gemini-3.6-flash", "output": output})
        return output
    return cached


# --- rankings + explanations -----------------------------------------------------------------

def combos() -> list[tuple[str, str, str]]:
    return list(product(rank_config.SCENARIOS, rank_config.FOCUSES, rank_config.VENTILATIONS))


def combo_key(scenario: str, focus: str, ventilation: str) -> str:
    return f"{scenario}__{focus}__{ventilation}"


def export_rankings(out: Path) -> dict[str, list[dict]]:
    records, placeholders = load_inputs()
    rankings = {}
    for scenario, focus, ventilation in combos():
        key = combo_key(scenario, focus, ventilation)
        results = rank(records, scenario, focus, ventilation, placeholders)
        rankings[key] = results
        write_json(out / "rankings" / f"{key}.json",
                   {"scenario": scenario, "focus": focus, "ventilation": ventilation, "results": results})
    return rankings


def export_scenarios(out: Path) -> None:
    write_json(out / "scenarios.json", {
        "scenarios": [{"key": k, **v} for k, v in rank_config.SCENARIOS.items()],
        "focuses": list(rank_config.FOCUSES), "ventilations": list(rank_config.VENTILATIONS),
        "partial_gravity_scenarios": sorted(rank_config.PARTIAL_GRAVITY_SCENARIOS),
    })


# Combos whose LLM wording was loose: tightened prompt; listed again in OFFLINE_EXPLANATIONS if the
# tightened text still reads loosely (then the deterministic reason-based text is used).
STRICT_EXPLANATIONS = {"moon_base__all__quiescent"}
OFFLINE_EXPLANATIONS: set[str] = set()


def export_explanations(out: Path, rankings: dict[str, list[dict]], use_llm: bool) -> dict[str, int]:
    from rag.explain import explain_ranking_detailed

    generate = None
    if use_llm:
        from rag.ask import gemini_generate as generate
    generator = _cached_llm(INTERIM / "explanations", generate)
    explanations, modes = {}, {"llm": 0, "offline": 0}
    for key, results in rankings.items():
        scenario, focus, ventilation = key.split("__")
        if key in OFFLINE_EXPLANATIONS:
            text, mode = explain_ranking_detailed(results, scenario, focus, _no_llm)
        else:
            text, mode = explain_ranking_detailed(results, scenario, focus, generator,
                                                  strict=key in STRICT_EXPLANATIONS)
        modes[mode] += 1
        explanations[key] = {"scenario": scenario, "focus": focus, "ventilation": ventilation,
                             "explanation": text, "mode": mode,
                             "top3": [{"psi_id": r["psi_id"], "acronym": r["acronym"], "total": r["total"]}
                                      for r in results[:3]]}
    write_json(out / "explanations.json", explanations)
    return modes


def _no_llm(prompt: str) -> str:
    raise RuntimeError("deterministic explanation requested")


# --- sources with summaries ------------------------------------------------------------------

SUMMARY_PROMPT = """Summarize this NASA page in exactly 2 plain-English sentences for a fire-safety
dashboard. Use only facts in the TEXT. Also return "quote": one short passage copied exactly,
character for character, from the TEXT that supports the summary.

TITLE: {title}

TEXT:
{text}
"""


def first_sentences(text: str, n: int = 2) -> str:
    body = re.sub(r"\s+", " ", text).strip()
    sentences = re.findall(r"[^.!?]+[.!?]", body)
    long_enough = [s.strip() for s in sentences if len(s.split()) >= 6]
    return " ".join(long_enough[:n]) or body[:300]


def summarize(source: dict, text: str, use_llm: bool) -> dict:
    """{summary, summary_quote, summary_mode} - LLM summary only if its quote is verbatim."""
    from extract.llm import quote_ok

    cache = INTERIM / "summaries" / f"{source['id']}.json"
    output = json.loads(cache.read_text(encoding="utf-8"))["output"] if cache.exists() else None
    if output is None and use_llm:
        try:
            output = _gemini_summary(source["title"], text)
            write_json(cache, {"model": os.environ.get("GEMINI_MODEL") or "gemini-3.6-flash", "output": output})
        except Exception as exc:
            print(f"  summary for {source['id']} unavailable ({type(exc).__name__}) - using first sentences")
    if output and output.get("summary") and quote_ok(output.get("quote", ""), text):
        return {"summary": output["summary"].strip(), "summary_quote": output["quote"], "summary_mode": "llm"}
    return {"summary": first_sentences(text), "summary_quote": None, "summary_mode": "first_sentences"}


def _gemini_summary(title: str, text: str) -> dict:
    from dotenv import load_dotenv
    from google import genai
    from google.genai import types
    from pydantic import BaseModel

    class Summary(BaseModel):
        summary: str
        quote: str

    load_dotenv(ROOT / ".env")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=os.environ.get("GEMINI_MODEL") or "gemini-3.6-flash",
        contents=SUMMARY_PROMPT.format(title=title, text=text[:30000]),
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Summary))
    return json.loads(response.text)


def export_sources(out: Path, use_llm: bool) -> dict[str, int]:
    from rag import config as rag_config
    from rag.build_index import read_resource

    sources, modes = [], {"llm": 0, "first_sentences": 0}
    for source in json.loads(rag_config.SOURCES_FILE.read_text(encoding="utf-8")):
        entry = dict(source)
        if source["type"] == "text":
            _, _, body = read_resource(rag_config.RESOURCES_DIR / f"{source['id']}.txt")
            entry.update(summarize(source, body, use_llm))
            modes[entry["summary_mode"]] += 1
        sources.append(entry)
    write_json(out / "sources.json", sources)
    return modes


# --- data explorer: one row per experimental-table row ----------------------------------------

# Columns that name the fuel or sample (first match per table wins); never rates, mass-flow
# controllers, concentrations or bottle IDs unless nothing better exists.
MATERIAL_HEADERS = re.compile(r"material|^fuel$|^fuel type$|^sample \(fuel type\)$|^sample type$", re.I)
MATERIAL_FALLBACK = re.compile(r"^fuel bottle$", re.I)
SIZE_HEADERS = re.compile(r"thick|samle thick|sample length|sample width|initial diameter|nozzle|burner size", re.I)
OUTCOME_HEADERS = re.compile(r"burn time|spread|burn length|extinction|burning rate|ignition time|hot ignition|"
                             r"self.?-?ext|flames ignited|cool flame\?|weight loss|rt/r0", re.I)


# O2 written as text in a non-O2 column (same source as extract/overrides/PSI-23.json).
TEXT_O2_COLUMNS = {"PSI-23": "Atmosphere*"}
TEXT_O2 = re.compile(r"(\d+(?:\.\d+)?)%")


def text_o2(cell: str) -> list[float]:
    """'~30% and ~21% O2 with He' -> [30.0, 21.0]; only when the cell mentions O2."""
    return [float(x) for x in TEXT_O2.findall(cell)] if "o2" in cell.lower() else []


def _row_range(kind: str, header: str, row: dict, column_rows: list[dict]) -> list[float] | None:
    """One row's value(s) for an O2 / pressure / airflow column, converted like csv_fields.find_range."""
    from extract import csv_fields as cf

    cell = row.get(header, "")
    nums = cf.parse_numbers(cell)
    if not nums:
        return None
    if kind == "o2":
        column = [n for r in column_rows for n in cf.parse_numbers(r.get(header, ""))]
        values = [n * (100.0 if cf.o2_is_fraction(header, column) else 1.0) for n in nums]
    else:
        values, problem = cf._column_values(header, [row], kind)
        if problem or not values:
            return None
    low, high = cf.VALID[kind]
    good = [v for v in values if (v > low if kind in cf.STRICT_LOW else v >= low) and (high is None or v <= high)]
    return [round(min(good), 4), round(max(good), 4)] if good else None


def _first(headers: list[str], matcher) -> str | None:
    if matcher is None:
        return None
    from extract import csv_fields as cf

    found = [h for h in headers if matcher(h)]
    initial = [h for h in found if not cf.FINAL.search(h)]
    return (initial or found or [None])[0]


def explorer_rows(records: list[dict]) -> dict:
    """Every test row with material, sample size, outcomes (raw text) and O2 / pressure / airflow
    in %, psi, cm/s. Values use the same column rules and unit conversions as the investigation
    ranges; anything not stated stays null. `tables` names the CSV column behind each value."""
    from extract import csv_fields as cf
    from extract.normalize import load_tables
    from extract.row_clean import clean_table

    tables, rows = {}, []
    for rec in records:
        for file_name, headers, raw_rows in load_tables(rec["psi_id"]):
            cols = {kind: _first(headers, m) for kind, m in
                    (("o2", cf.is_o2_column), ("pressure", cf.is_pressure_column), ("airflow", cf.is_airflow_column))}
            text_col = TEXT_O2_COLUMNS.get(rec["psi_id"])
            material = next((h for h in headers if MATERIAL_HEADERS.search(h.strip())), None) or                 next((h for h in headers if MATERIAL_FALLBACK.search(h.strip())), None)
            sizes = [h for h in headers if SIZE_HEADERS.search(h)]
            outcomes = [h for h in headers if OUTCOME_HEADERS.search(h)]
            cleaned = clean_table(rec["psi_id"], headers, raw_rows, material)
            table_rows = [cr.cells for cr in cleaned.rows]
            used = {k: False for k in cols}
            for cr in cleaned.rows:
                row = cr.cells
                raw_material = ((row.get(material) or "").strip() or None) if material else None
                entry = {"psi_id": rec["psi_id"], "table": file_name, "row": cr.row,
                         "material": cr.material_label or raw_material,
                         "size": "; ".join(f"{h.strip()}: {row[h].strip()}" for h in sizes if (row.get(h) or "").strip()) or None,
                         "outcomes": "; ".join(f"{h.strip()}: {row[h].strip()}" for h in outcomes if (row.get(h) or "").strip()) or None}
                for kind, header in cols.items():
                    entry[kind] = _row_range(kind, header, row, table_rows) if header else None
                if entry["o2"] is None and text_col and (pcts := text_o2(row.get(text_col, ""))):
                    entry["o2"] = [min(pcts), max(pcts)]
                    cols["o2"] = text_col
                for kind in cols:
                    used[kind] |= entry[kind] is not None
                if cr.flags:
                    entry["flags"] = cr.flags
                rows.append(entry)
            tables[file_name] = {"psi_id": rec["psi_id"], "rows": len(table_rows), "csv_rows": len(raw_rows),
                                 "columns": {k: (h.strip() if h and used[k] else None) for k, h in cols.items()},
                                 "material_column": material.strip() if material else None,
                                 "size_columns": [h.strip() for h in sizes],
                                 "outcome_columns": [h.strip() for h in outcomes],
                                 "excluded": cleaned.excluded,
                                 "notes": cleaned.notes}
    return {"tables": tables, "rows": rows}


def export_explorer(out: Path, records: list[dict]) -> int:
    data = explorer_rows(records)
    path = out / "explorer.json"
    # Compact (no indent): ~2,000 rows; the site fetches it only on the Data Explorer page.
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(data["rows"])


# --- meta + main -----------------------------------------------------------------------------

def data_commit() -> str:
    """The commit the exported data was built from (HEAD at export time)."""
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True,
                              check=True).stdout.strip()
    except Exception:
        return "unknown"


def export_meta(out: Path, records: list[dict], index: dict, counts: dict) -> None:
    from rag import config as rag_config

    extraction_models = sorted({json.loads(p.read_text(encoding="utf-8")).get("model", "")
                                for p in (INTERIM / "llm").glob("*.json")})
    write_json(out / "meta.json", {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_commit": data_commit(),
        "counts": {"investigations": len(records),
                   "experimental_table_csvs": len(list((ROOT / "data" / "raw").glob("PSI-*/*.csv"))),
                   "investigations_with_tables": sum(1 for r in records if r["tests"]),
                   "chunks": len(index["chunks"]), "ranking_files": counts["rankings"],
                   "test_rows": counts.get("explorer_rows", 0)},
        "models": {"embedding": f"{index['model']} ({index['dims']} dims)",
                   "answer": os.environ.get("GEMINI_MODEL") or rag_config.DEFAULT_MODEL,
                   "extraction": extraction_models},
        "explanations": counts["explanations"], "source_summaries": counts["summaries"],
    })


def main(argv: list[str] | None = None, out: Path = WEB_DATA) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--no-llm", action="store_true", help="no Gemini calls (cached output still used)")
    args = parser.parse_args(argv)
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")

    records = json.loads((PROCESSED / "investigations.json").read_text(encoding="utf-8"))
    bad = {r.get("psi_id"): p for r in records if (p := validate_record(r))}
    if bad:
        raise SystemExit(f"Contract violations, nothing exported: {bad}")

    if (out / "rankings").exists():
        shutil.rmtree(out / "rankings")  # no stale combos
    for name in ("investigations.json", "provenance.json", "demo_answers.json", "rag_index.json", "rag_eval.json"):
        copy(PROCESSED / name, out / name)
    copy(ROOT / "rag" / "config.json", out / "rag_config.json")
    copy(ROOT / "rag" / "prompt.md", out / "rag_prompt.md")
    copy(ROOT / "rank" / "README.md", out / "rubric.md")
    export_scenarios(out)
    rankings = export_rankings(out)
    counts = {"rankings": len(rankings),
              "explanations": export_explanations(out, rankings, not args.no_llm),
              "summaries": export_sources(out, not args.no_llm)}
    counts["explorer_rows"] = export_explorer(out, records)
    index = json.loads((PROCESSED / "rag_index.json").read_text(encoding="utf-8"))
    export_meta(out, records, index, counts)

    files = sorted(p for p in out.rglob("*") if p.is_file())
    print(f"\nExported {len(files)} files to {out.relative_to(ROOT)}:")
    for p in files:
        if p.parent.name != "rankings":
            print(f"  {p.relative_to(out).as_posix():28} {p.stat().st_size / 1024:8.1f} KB")
    ranking_kb = sum(p.stat().st_size for p in files if p.parent.name == "rankings") / 1024
    print(f"  {'rankings/ (' + str(len(rankings)) + ' files)':28} {ranking_kb:8.1f} KB")
    print(f"  {'TOTAL':28} {sum(p.stat().st_size for p in files) / 1e6:8.2f} MB")
    print(f"  explanations: {counts['explanations']}  summaries: {counts['summaries']}")


if __name__ == "__main__":
    main()
