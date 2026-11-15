"""data/raw/ -> data/processed/investigations.json (+ provenance.json, extract/REVIEW.md).

Usage:
    python -m extract.normalize                      # all IDs in ingest/psi_ids.txt
    python -m extract.normalize --ids PSI-98 PSI-69  # only these (merged into existing output)
    python -m extract.normalize --no-llm             # copied/CSV/rule fields only
    python -m extract.normalize --refresh-llm        # ignore data/interim/llm/ cache

Priority per field: override > rule / CSV / JSON > LLM. Values that can't be traced to PSI
are null / "not reported" / []. Every value's source goes to provenance.json.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from extract import csv_fields, llm, row_clean
from ingest.fetch_psi import read_ids

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"
EXTRACT_DIR = ROOT / "extract"
OVERRIDES_DIR = EXTRACT_DIR / "overrides"
CHECKED_FILE = EXTRACT_DIR / "checked_ids.txt"
REVIEW_FILE = EXTRACT_DIR / "REVIEW.md"
PSI_PAGE = "https://psi.nasa.gov/physci/repo/data/investigations/{psi_id}"
NOT_REPORTED = llm.NOT_REPORTED

CONTRACT_KEYS = ["psi_id", "acronym", "title", "doi", "platform", "hardware", "fuel_phase", "fuels",
                 "o2_percent_range", "pressure_psi_range", "airflow_cm_s_range", "gravity", "pillars",
                 "measurements", "objective_summary", "key_findings", "earth_applications", "tests",
                 "source_urls", "extraction_confidence"]
REVIEW_FIRST = ["PSI-98", "PSI-26", "PSI-69", "PSI-101", "PSI-159", "PSI-22"]

# Seeds from the challenge brief (AGENTS.md "Key domain facts"); they beat the LLM.
PILLAR_SEEDS = {
    "PSI-102": ["detection"], "PSI-101": ["detection"], "PSI-47": ["detection"],    # SAME, SAME-R, DAFT
    "PSI-69": ["suppression"], "PSI-68": ["suppression"],                           # FLEX, FLEX-2
    "PSI-26": ["prevention", "suppression"], "PSI-25": ["prevention", "suppression"],  # BASS, BASS-II
    "PSI-98": ["prevention"], "PSI-99": ["prevention"], "PSI-100": ["prevention"],  # SAFFIRE-I/II/III
    # All ACME (Flame Design, BRE, CLD Flame, E-FIELD, s-Flame, CFI-G): extinction/flammability
    # limits of gas flames inform prevention; suppression is FLEX-style CO2/He dilution.
    **dict.fromkeys(["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"], ["prevention"]),
}
FUEL_PHASE_SEEDS = {
    **dict.fromkeys(["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"], "gas"),  # ACME
    **dict.fromkeys(["PSI-69", "PSI-68", "PSI-39"], "liquid_droplet"),                      # FLEX, FLEX-2, CFI
    **dict.fromkeys(["PSI-98", "PSI-99", "PSI-100"], "solid"),                              # SAFFIRE
    # AGENTS.md (BASS/BASS-II solid-material flammability; SPICE/SLICE gaseous co-flow flames),
    # confirmed in each PSI JSON: cotton/fiberglass fabric, "solid fuels"; methane/ethylene/propane.
    **dict.fromkeys(["PSI-26", "PSI-25"], "solid"),                                         # BASS, BASS-II
    **dict.fromkeys(["PSI-107", "PSI-106"], "gas"),                                         # SPICE, SLICE
}
GRAVITY_SEEDS = {"PSI-22": "partial_mimic"}  # E-FIELD Flames mimic partial gravity
# The contract requires a fuel_phase enum value; used only when neither seed nor verified LLM
# value exists, and always flagged in REVIEW.md.
FUEL_PHASE_FALLBACK = "mixed"


def is_placeholder(field_provenance) -> bool:
    """True when a value only exists to satisfy the contract (scoring must treat it as unknown)."""
    return isinstance(field_provenance, dict) and field_provenance.get("placeholder") is True


def text_or_nr(value) -> str:
    value = (value or "").strip() if isinstance(value, str) else value
    return value if value else NOT_REPORTED


def acronym_of(inv: dict) -> tuple[str, str]:
    if (inv.get("investigationAcronym") or "").strip():
        return inv["investigationAcronym"].strip(), "json:investigationAcronym"
    parens = re.findall(r"\(([^()]+)\)", inv.get("title") or "")
    if parens:
        return parens[-1].strip(), "json:title (last parentheses)"
    return NOT_REPORTED, "missing"


def platform_of(inv: dict) -> tuple[str, str]:
    for key in ("flightProgram", "missionName"):
        value = (inv.get(key) or "").strip()
        if value and value.lower() != "not applicable":
            return value, f"json:{key}"
    if inv.get("payloads"):
        return "; ".join(map(str, inv["payloads"])), "json:payloads"
    if (inv.get("projectType") or "").strip():
        return inv["projectType"].strip(), "json:projectType"
    return NOT_REPORTED, "missing"


def hardware_of(inv: dict) -> tuple[str, str]:
    value = inv.get("experimentHardware")
    if isinstance(value, list):
        value = ", ".join(map(str, value))
    value = re.sub(r"\s+", " ", value or "").strip()
    return (value, "json:experimentHardware") if value else (NOT_REPORTED, "missing")


def load_tables(psi_id: str) -> list[tuple[str, list[str], list[dict[str, str]]]]:
    folder = RAW_DIR / psi_id
    return [(p.name, *csv_fields.read_csv(p)) for p in sorted(folder.glob("*.csv"))] if folder.is_dir() else []


def clean_tables(psi_id: str, tables) -> tuple[list, list[str]]:
    """Tables with only real test rows (extract/row_clean.py), plus one note per table that lost rows."""
    out, notes = [], []
    for file_name, headers, rows in tables:
        ct = row_clean.clean_table(psi_id, headers, rows)
        out.append((file_name, headers, [r.cells for r in ct.rows]))
        if ct.excluded:
            reasons: dict[str, int] = {}
            for e in ct.excluded:
                key = "exact duplicate rows" if e["reason"].startswith("exact duplicate") else e["reason"]
                reasons[key] = reasons.get(key, 0) + 1
            notes.append(f"tests: {file_name}: {len(rows)} CSV rows -> {len(ct.rows)} test rows; removed "
                         + "; ".join(f"{n} {k}" for k, n in reasons.items()))
    return out, notes


def tests_of(tables) -> list[dict[str, str]]:
    rows = []
    for file_name, _, table_rows in tables:
        for row in table_rows:
            rows.append({**row, "_table": file_name} if len(tables) > 1 else dict(row))
    return rows


def read_checked(path: Path = CHECKED_FILE) -> set[str]:
    if not path.exists():
        return set()
    return {line.split()[0] for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")}


def load_override(psi_id: str, folder: Path = OVERRIDES_DIR) -> dict:
    path = folder / f"{psi_id}.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    unknown = {k for k in data if not k.startswith("_")} - set(CONTRACT_KEYS)
    if unknown:
        raise ValueError(f"{path.name}: not contract fields: {sorted(unknown)}")
    return data


def build_record(psi_id: str, use_llm: bool = True, refresh_llm: bool = False,
                 overrides_dir: Path = OVERRIDES_DIR, checked: set[str] | None = None) -> tuple[dict, dict]:
    """One contract record + its provenance for one PSI ID."""
    inv = json.loads((RAW_DIR / f"{psi_id}.json").read_text(encoding="utf-8"))
    raw_tables = load_tables(psi_id)
    tables, notes = clean_tables(psi_id, raw_tables)
    rec, prov = {}, {}

    rec["psi_id"], prov["psi_id"] = inv.get("accession") or psi_id, "json:accession"
    rec["acronym"], prov["acronym"] = acronym_of(inv)
    rec["title"], prov["title"] = text_or_nr(inv.get("title")), "json:title"
    rec["doi"], prov["doi"] = text_or_nr(inv.get("doi")), "json:doi"
    rec["platform"], prov["platform"] = platform_of(inv)
    rec["hardware"], prov["hardware"] = hardware_of(inv)

    for field, kind in (("o2_percent_range", "o2"), ("pressure_psi_range", "pressure"),
                        ("airflow_cm_s_range", "airflow")):
        result = csv_fields.find_range(kind, tables)
        rec[field] = result.value
        prov[field] = result.columns if result.value else ("csv:none" if tables else "no_csv")
        notes += [f"{field}: {n}" for n in result.notes]

    if psi_id in GRAVITY_SEEDS:
        rec["gravity"], prov["gravity"] = GRAVITY_SEEDS[psi_id], "rule:gravity_seed (mimics partial gravity)"
    elif (inv.get("projectType") or "").lower().startswith("ground"):
        rec["gravity"], prov["gravity"] = "microgravity", "rule:gravity_seed (ground/modeling study of flight data)"
    else:
        rec["gravity"], prov["gravity"] = "microgravity", "rule:gravity_seed"

    rec["tests"] = tests_of(tables)
    prov["tests"] = [f"csv:{t[0]}" for t in tables] or "no_csv"
    rec["source_urls"], prov["source_urls"] = [PSI_PAGE.format(psi_id=psi_id)], "rule:psi_page"

    # LLM fields (seeds win for fuel_phase / pillars).
    rejected: list[str] = []
    if use_llm:
        text = llm.build_input(inv, raw_tables)  # raw: keeps the cached, quote-verified LLM output valid
        values, llm_prov, rejected = llm.verify(llm.extract(psi_id, text, refresh_llm), text)
    else:
        values = {f: ([] if k in ("list", "pillars") else NOT_REPORTED) for f, k in llm.LLM_FIELDS.items()}
        llm_prov = {f: "no_llm" for f in llm.LLM_FIELDS}
    for field in llm.LLM_FIELDS:
        rec[field], prov[field] = values[field], llm_prov[field]
    if psi_id in FUEL_PHASE_SEEDS:
        rec["fuel_phase"], prov["fuel_phase"] = FUEL_PHASE_SEEDS[psi_id], "rule:fuel_phase_seed"
    if psi_id in PILLAR_SEEDS:
        rec["pillars"], prov["pillars"] = list(PILLAR_SEEDS[psi_id]), "rule:pillar_seed"
    if rec["fuel_phase"] == NOT_REPORTED:
        rec["fuel_phase"] = FUEL_PHASE_FALLBACK
        prov["fuel_phase"] = {"source": "placeholder", "placeholder": True,
                              "reason": "not supported by PSI text; contract needs an enum value - treat as unknown"}

    override = load_override(psi_id, overrides_dir)
    source = override.get("_source")  # one note for every field, or {field: note}
    for field, value in override.items():
        if not field.startswith("_"):
            rec[field] = value
            note = source.get(field) if isinstance(source, dict) else source
            prov[field] = {"source": "override", "quote": note} if note else "override"
    if is_placeholder(prov["fuel_phase"]):
        notes.append("fuel_phase: PLACEHOLDER 'mixed' (unknown) - scoring treats it as unknown; needs a human override")

    checked = read_checked() if checked is None else checked
    rec["extraction_confidence"] = "checked" if psi_id in checked else "llm_unchecked"
    prov["extraction_confidence"] = "extract/checked_ids.txt"
    prov["_notes"], prov["_rejected_quotes"] = notes, rejected
    return {k: rec[k] for k in CONTRACT_KEYS}, prov


# --- output ----------------------------------------------------------------------------------

def _load_by_id(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {r["psi_id"]: r for r in data} if isinstance(data, list) else data


def _dump(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def n_not_reported(rec: dict) -> int:
    return sum(1 for k in CONTRACT_KEYS if rec[k] in (NOT_REPORTED, None, []))


def fmt_range(r) -> str:
    return "-" if r is None else (f"{r[0]:g}" if r[0] == r[1] else f"{r[0]:g}-{r[1]:g}")


def summary_table(records: list[dict], provenance: dict) -> str:
    lines = ["| PSI ID | acronym | fuel_phase | pillars | O2 % | pressure psi | airflow cm/s | #tests | #not reported | #quotes rejected |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for r in records:
        p = provenance[r["psi_id"]]
        lines.append(f"| {r['psi_id']} | {r['acronym']} | {r['fuel_phase']} | {', '.join(r['pillars']) or '-'} | "
                     f"{fmt_range(r['o2_percent_range'])} | {fmt_range(r['pressure_psi_range'])} | "
                     f"{fmt_range(r['airflow_cm_s_range'])} | {len(r['tests'])} | {n_not_reported(r)} | "
                     f"{len(p['_rejected_quotes'])} |")
    return "\n".join(lines)


def _prov_text(p) -> str:
    if isinstance(p, dict):
        quotes = [p["quote"]] if "quote" in p else p.get("quotes", [])
        return p["source"] + "".join(f'<br>> "{q}"' for q in quotes)
    if isinstance(p, list):
        return "<br>".join(f"`{x}`" for x in p)
    return f"`{p}`"


def _value_text(field: str, value) -> str:
    if field == "tests":
        return f"{len(value)} rows"
    text = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
    return text.replace("|", "\\|").replace("\n", " ")


def write_review(records: list[dict], provenance: dict, path: Path = REVIEW_FILE) -> None:
    ordered = sorted(records, key=lambda r: (REVIEW_FIRST.index(r["psi_id"]) if r["psi_id"] in REVIEW_FIRST
                                             else len(REVIEW_FIRST)))
    out = ["# Extraction review checklist", "",
           "Generated by `python -m extract.normalize` - edit fixes in `extract/overrides/<PSI-ID>.json`, not here.",
           "Check each value against the PSI page, tick the box, and when an ID is fully verified add it to",
           "`extract/checked_ids.txt` (that sets `extraction_confidence` to `checked`).", "",
           f"**Check these six first:** {', '.join(REVIEW_FIRST)}.", "",
           "## Columns / values needing a human look", ""]
    flagged = [(r["psi_id"], n) for r in ordered for n in provenance[r["psi_id"]]["_notes"]]
    out += [f"- **{pid}** - {n}" for pid, n in flagged] or ["- none"]
    rejected = [(r["psi_id"], q) for r in ordered for q in provenance[r["psi_id"]]["_rejected_quotes"]]
    out += ["", "## LLM values rejected (quote not found in PSI text)", ""]
    out += [f"- **{pid}** - {q}" for pid, q in rejected] or ["- none"]
    out += ["", "## Summary", "", summary_table(records, provenance), ""]
    for r in ordered:
        pid = r["psi_id"]
        out += [f"## {pid} - {r['acronym']}", "", f"PSI page: {PSI_PAGE.format(psi_id=pid)} · DOI: {r['doi']}", "",
                "| ok | field | value | source |", "|---|---|---|---|"]
        for field in CONTRACT_KEYS:
            out.append(f"| [ ] | {field} | {_value_text(field, r[field])} | {_prov_text(provenance[pid][field])} |")
        out.append("")
    path.write_text("\n".join(out), encoding="utf-8")


def main(argv: list[str] | None = None) -> list[dict]:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ids", nargs="+", help="only these PSI IDs (default: ingest/psi_ids.txt)")
    parser.add_argument("--no-llm", action="store_true", help="skip Gemini; LLM fields -> not reported / []")
    parser.add_argument("--refresh-llm", action="store_true", help="ignore the cached LLM output")
    args = parser.parse_args(argv)

    if not args.no_llm:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
        if not llm.os.environ.get("GEMINI_API_KEY"):
            parser.error("GEMINI_API_KEY missing from .env (or run with --no-llm)")

    all_ids = read_ids()
    ids = args.ids or all_ids
    checked = read_checked()
    records = _load_by_id(OUT_DIR / "investigations.json")
    provenance = _load_by_id(OUT_DIR / "provenance.json")
    for psi_id in ids:
        print(psi_id)
        records[psi_id], provenance[psi_id] = build_record(psi_id, not args.no_llm, args.refresh_llm, checked=checked)

    order = {pid: i for i, pid in enumerate(all_ids)}
    ordered = sorted(records.values(), key=lambda r: order.get(r["psi_id"], len(order)))
    _dump(OUT_DIR / "investigations.json", ordered)
    _dump(OUT_DIR / "provenance.json", {r["psi_id"]: provenance[r["psi_id"]] for r in ordered})
    write_review(ordered, provenance)
    print("\n" + summary_table([records[i] for i in ids], provenance))
    return ordered


if __name__ == "__main__":
    main()
