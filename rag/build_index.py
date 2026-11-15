"""Build the AI librarian's search index -> data/processed/rag_index.json (Gemini embeddings).

Usage:
    python -m rag.build_index

Three kinds of chunks:
  1. PSI text     - objective/approach/hypothesis/researchImpacts/description of data/raw/<ID>.json
  2. fact cards   - one per investigation from data/processed/investigations.json (the numbers),
                    plus 3 comparison tables (O2 / pressure / airflow) and a gravity-coverage chunk
  3. resources    - data/raw/resources/*.txt (the other NASA pages; cited by title + URL)
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from rag import config

NOT_REPORTED = "not reported"


# --- chunking --------------------------------------------------------------------------------

def _split_long(paragraph: str, limit: int) -> list[str]:
    """Split a paragraph into pieces of at most `limit` chars, only at spaces."""
    pieces, current = [], ""
    for word in paragraph.split():
        if current and len(current) + 1 + len(word) > limit:
            pieces.append(current)
            current = word
        else:
            current = f"{current} {word}" if current else word
    if current:
        pieces.append(current)
    return pieces


def _tail(text: str, n: int) -> str:
    """Last ~n chars of text, starting at a word boundary."""
    if len(text) <= n:
        return text
    tail = text[-n:]
    return tail.split(" ", 1)[1] if " " in tail else ""


def chunk_text(text: str, size: int = config.CHUNK_CHARS, overlap: int = config.CHUNK_OVERLAP) -> list[str]:
    """Paragraph-aware chunks of <= size chars; each chunk after the first starts with the last
    ~overlap chars of the previous one. Never cuts inside a word."""
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    units = [u for p in paragraphs if p for u in _split_long(p, size - overlap - 1)]
    chunks, current = [], ""
    for unit in units:
        if not current:
            current = unit
        elif len(current) + 2 + len(unit) <= size:
            current = f"{current}\n\n{unit}"
        else:
            chunks.append(current)
            tail = _tail(current, overlap)
            current = f"{tail} {unit}" if tail else unit
    if current:
        chunks.append(current)
    return chunks


# --- documents -------------------------------------------------------------------------------

def _fmt_range(r, unit: str) -> str:
    if r is None:
        return NOT_REPORTED
    return f"{r[0]:g} {unit}" if r[0] == r[1] else f"{r[0]:g}–{r[1]:g} {unit}"


def _list(values) -> str:
    return "; ".join(values) if values else NOT_REPORTED


def fact_card(record: dict) -> str:
    """Short, number-bearing summary of one investigation (values exactly from investigations.json)."""
    return "\n".join([
        f"Fact card: {record['psi_id']} {record['acronym']} — {record['title']}",
        f"DOI: {record['doi']}",
        f"Platform: {record['platform']}; hardware: {record['hardware']}",
        f"Fuel phase: {record['fuel_phase']}",
        f"Fuels: {_list(record['fuels'])}",
        f"Oxygen tested: {_fmt_range(record['o2_percent_range'], '% O2')}",
        f"Pressure tested: {_fmt_range(record['pressure_psi_range'], 'psi')}",
        f"Airflow tested: {_fmt_range(record['airflow_cm_s_range'], 'cm/s')}",
        f"Fire-safety pillars: {_list(record['pillars'])}",
        f"Gravity: {record['gravity']}",
        f"Measurements: {_list(record['measurements'])}",
        f"Experimental test rows: {len(record['tests'])}",
    ])


COMPARISONS = (("o2_percent_range", "oxygen", "% O2"), ("pressure_psi_range", "pressure", "psi"),
               ("airflow_cm_s_range", "airflow", "cm/s"))


def comparison_table(records: list[dict], field: str, name: str, unit: str) -> str:
    """One chunk comparing a tested range across all investigations (highest first), so questions
    like "which experiments went above 30% O2?" can be answered from a single source."""
    reported = sorted((r for r in records if r[field]), key=lambda r: -r[field][1])
    lines = [f"Comparison table: {name} levels tested in NASA PSI combustion investigations "
             f"(highest {name} first; from the experimental tables)"]
    lines += [f"- {r['psi_id']} {r['acronym']}: {_fmt_range(r[field], unit)} (DOI {r['doi']})" for r in reported]
    missing = [r["psi_id"] for r in records if not r[field]]
    lines.append(f"{name.capitalize()} not reported for: {', '.join(missing) or 'none'}")
    return "\n".join(lines)


PSI_SEARCH_URL = "https://psi.nasa.gov/physci/repo/search?q=combustion"
GRAVITY_TEXT = {"microgravity": "microgravity", "normal": "normal (1 g) gravity",
                "partial_mimic": "an electric field used to mimic partial gravity"}


def coverage_text(records: list[dict]) -> str:
    """What gravity conditions PSI's combustion investigations cover - all counts computed from
    the records, so the librarian can state the partial-gravity gap from the data itself."""
    by_gravity: dict[str, list[dict]] = {}
    for r in records:
        by_gravity.setdefault(r["gravity"], []).append(r)
    n = len(records)
    lines = [f"PSI Combustion Science coverage: gravity conditions of all {n} investigations in the "
             f"NASA PSI Data Repository (from investigations.json)."]
    for gravity in ("microgravity", "partial_mimic", "normal"):
        group = by_gravity.get(gravity, [])
        names = ", ".join(r["psi_id"] if r["acronym"] == NOT_REPORTED else f"{r['psi_id']} {r['acronym']}"
                          for r in group) or "none"
        lines.append(f"- {len(group)} of {n}: {GRAVITY_TEXT[gravity]} ({names})")
    mimics = by_gravity.get("partial_mimic", [])
    if mimics:
        named = "; ".join(f"{r['psi_id']} ({r['acronym']})" for r in mimics)
        lead = "The only one is" if len(mimics) == 1 else "They are"
        lines.append(f"Closest PSI data to Moon gravity: {lead} {named}, which used an electric field "
                     f"to mimic partial gravity.")
    real = [r for r in records if r["gravity"] not in GRAVITY_TEXT]
    lines.append(f"- {len(real)} of {n} were run in real Moon (lunar) gravity. "
                 f"PSI contains no real partial-gravity combustion data from these investigations."
                 if not real else f"- Other gravity values: {', '.join(r['psi_id'] for r in real)}")
    return "\n".join(lines)


def _psi_meta(record: dict, field: str) -> dict:
    return {"source_type": "psi", "psi_id": record["psi_id"], "acronym": record["acronym"],
            "title": record["title"], "doi": record["doi"], "field": field,
            "url": config.PSI_PAGE.format(psi_id=record["psi_id"])}


def psi_documents(records: list[dict], raw_dir: Path = config.RAW_DIR) -> list[tuple[str, str, dict]]:
    """(id, text, metadata) for PSI text fields and fact cards."""
    docs = []
    for record in records:
        pid = record["psi_id"]
        raw = json.loads((raw_dir / f"{pid}.json").read_text(encoding="utf-8"))
        for field in config.PSI_TEXT_FIELDS:
            for i, chunk in enumerate(chunk_text(str(raw.get(field) or ""))):
                docs.append((f"psi:{pid}:{field}:{i}", chunk, _psi_meta(record, field)))
        docs.append((f"fact:{pid}", fact_card(record), _psi_meta(record, "fact_card")))
    for field, name, unit in COMPARISONS:
        meta = {"source_type": "psi", "psi_id": "PSI (all)", "acronym": f"{name} comparison",
                "title": f"PSI comparison table: {name}", "doi": "per row", "field": f"comparison_{name}",
                "url": PSI_SEARCH_URL}
        docs.append((f"compare:{name}", comparison_table(records, field, name, unit), meta))
    docs.append(("coverage:gravity", coverage_text(records),
                 {"source_type": "psi", "psi_id": "PSI (all)", "acronym": "coverage",
                  "title": f"PSI Combustion Science coverage ({len(records)} investigations)",
                  "doi": "per investigation", "field": "coverage", "url": PSI_SEARCH_URL}))
    return docs


def read_resource(path: Path) -> tuple[str, str, str]:
    """(title, url, body) from a 'Title: / URL: / blank / text' file."""
    header, _, body = path.read_text(encoding="utf-8").partition("\n\n")
    fields = dict(line.split(": ", 1) for line in header.splitlines() if ": " in line)
    return fields.get("Title", path.stem), fields.get("URL", ""), body


def resource_documents(resources_dir: Path = config.RESOURCES_DIR) -> list[tuple[str, str, dict]]:
    docs = []
    for path in sorted(resources_dir.glob("*.txt")):
        title, url, body = read_resource(path)
        for i, chunk in enumerate(chunk_text(body)):
            docs.append((f"res:{path.stem}:{i}", chunk,
                         {"source_type": "resource", "id": path.stem, "title": title, "url": url}))
    return docs


def all_documents() -> list[tuple[str, str, dict]]:
    records = json.loads((config.PROCESSED_DIR / "investigations.json").read_text(encoding="utf-8"))
    return psi_documents(records) + resource_documents()


# --- embeddings + JSON index -------------------------------------------------------------------

def chunk_record(doc_id: str, text: str, meta: dict) -> dict:
    """Flat chunk entry for rag_index.json (same shape Python and the website read)."""
    record = {"id": doc_id, "text": text, "source_type": meta["source_type"]}
    if meta["source_type"] == "psi":
        record.update(psi_id=meta["psi_id"], acronym=meta["acronym"], doi=meta["doi"])
    else:
        record["resource_id"] = meta["id"]
    record.update(title=meta["title"], url=meta["url"], field=meta.get("field", "resource"))
    return record


def kind(chunk: dict) -> str:
    field = chunk["field"]
    if field.startswith("comparison"):
        return "comparison"
    return field if field in ("fact_card", "coverage") else chunk["source_type"]


def build(docs: list[tuple[str, str, dict]] | None = None, path: Path = config.INDEX_FILE) -> dict:
    from rag.embeddings import embed_documents, encode_b64

    docs = all_documents() if docs is None else docs
    chunks = [chunk_record(*d) for d in docs]
    vectors_b64 = encode_b64(embed_documents([c["text"] for c in chunks]))
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    unchanged = previous.get("chunks") == chunks and previous.get("vectors_b64") == vectors_b64
    index = {"model": config.EMBEDDING_MODEL, "dims": config.EMBEDDING_DIMS,
             "created_at": previous["created_at"] if unchanged else
             datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "chunks": chunks, "vectors_b64": vectors_b64}
    path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return index


def main() -> None:
    index = build()
    counts = Counter(kind(c) for c in index["chunks"])
    print("Chunks indexed:")
    for name in ("psi", "fact_card", "comparison", "coverage", "resource"):
        print(f"  {name:10} {counts.get(name, 0)}")
    size = config.INDEX_FILE.stat().st_size / 1e6
    print(f"  {'total':10} {len(index['chunks'])}  -> {config.INDEX_FILE.relative_to(config.ROOT)} ({size:.2f} MB)")


if __name__ == "__main__":
    main()
