"""Row-level cleaning of PSI experimental tables (the manual-cleaning pass).

Ported from the team's hand-cleaning notebooks (nasa98-99final.ipynb for SAFFIRE-I/II,
nasa102-159final.ipynb for SPICE, SAME, SLICE, PSI-142 and CFI-G) and generalised so the same
rules run on every table:

* Rows that are not tests are removed from the test list and kept as table notes:
  footnote lines ("Note 1 ..."), flow-visualization references with no data, note-only
  continuation rows, "same conditions as 1-4" rows with no measurements, and exact duplicates.
* Kept rows get flags for problems a reader must know about (typos, blank cells, impossible
  values, times that run backwards). Cell values are never changed here; the only
  correction is the explorer's material *label* for obvious spreadsheet fill-series artifacts
  (e.g. "40% CH5" in a methane test), and the raw label is always kept in the flag.

Pure functions, no I/O. Row numbers are 1-based positions in the non-blank CSV rows, the same
numbering the Data Explorer and the CSV download use.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

NOTE_COLUMNS = re.compile(r"^(notes?|comments?)$", re.I)
FOOTNOTE = re.compile(r"^\s*note\s*\d+\b", re.I)
FLOW_VIS = re.compile(r"flow\s*visu", re.I)                       # "visulation" typo in the source
SAME_CONDITIONS = re.compile(r"same conditions as", re.I)

# Spreadsheet fill-series artifacts: "40% CH4" dragged down became CH5, CH6 ... CH14; "C2H4" became
# C2H5 ... C2H11; "with N2" became N3 ... N6. None of these are fuels/diluents (CH5, C2H11 and N3
# don't exist as stable gases), every run of them starts from the real species, and the PSI text
# names only methane, ethylene and nitrogen. Applied only to these two tables.
FILL_SERIES = {
    "PSI-21": [(re.compile(r"\bCH(?:[5-9]|1\d)\b"), "CH4"), (re.compile(r"\bC2H(?:[5-9]|1\d)\b"), "C2H4")],
    "PSI-23": [(re.compile(r"\bN[3-9]\b"), "N2")],
}
PERCENT_SPACING = re.compile(r"(\d)\s*%\s*(?=[A-Za-z])")          # "75 % Propylene", "100%C2H4"


@dataclass
class CleanRow:
    row: int                       # 1-based position in the CSV's non-blank rows
    cells: dict[str, str]          # unchanged CSV cells
    flags: list[str] = field(default_factory=list)
    material_label: str | None = None  # set only when the label was normalised/corrected


@dataclass
class CleanTable:
    rows: list[CleanRow]
    excluded: list[dict]           # {"row": n, "reason": str, "text": str}
    notes: list[str]               # footnotes and note-only lines, verbatim


def _blank(v: str | None) -> bool:
    return not (v or "").strip()


def _data_cells(row: dict[str, str]) -> dict[str, str]:
    return {h: v for h, v in row.items() if not NOTE_COLUMNS.match(h.strip()) and not _blank(v)}


def _row_text(row: dict[str, str]) -> str:
    return " | ".join(v.strip() for v in row.values() if not _blank(v))


def _classify(row: dict[str, str], headers: list[str]) -> str | None:
    """Reason a row is not a test, or None when it is a test row."""
    data = _data_cells(row)
    first = (row.get(headers[0]) or "").strip() if headers else ""
    if FOOTNOTE.match(first) and len(data) == 1:
        return "footnote line, not a test"
    if any(FLOW_VIS.search(v) for v in data.values()) and len(data) <= 2:
        return "flow-visualization reference with no test data"
    if any(SAME_CONDITIONS.search(v) for v in data.values()) and len(data) <= 2:
        return "listed as 'same conditions' but no measurements reported"
    if len(data) < 2:
        return "note / continuation row with no test identity"
    return None


def _flags(psi_id: str, row: dict[str, str], material_col: str | None) -> list[str]:
    flags = []
    for h, v in row.items():
        cell = (v or "").strip()
        hl = h.lower()
        if not cell:
            continue
        if "thick" in hl and re.fullmatch(r"0?\d{2,}\s*mm", cell) and cell.startswith("0") and "." not in cell:
            flags.append(f"{h.strip()} '{cell}' looks like a typo for 0.{cell[1:]} (source value kept, not converted)")
        if "thick" in hl and re.search(r"\band\b", cell):
            flags.append(f"{h.strip()} '{cell}' is a two-layer sample, not one thickness")
        if "thick" in hl and re.search(r"fig", cell, re.I):
            flags.append(f"{h.strip()} refers to a figure that is not in the PSI table")
        if re.fullmatch(r"#(DIV/0!|VALUE!|N/A|REF!)", cell):
            flags.append(f"{h.strip()} is a spreadsheet error ('{cell}') in the source; treated as not reported")
        if ("o2" in hl or "oxygen" in hl) and (m := re.fullmatch(r"(\d+)00%", cell)) and int(cell[:-1]) > 100:
            flags.append(f"{h.strip()} '{cell}' is a %-format error in the source (probably {m.group(1)}%); not used")
    if material_col and _blank(row.get(material_col)):
        flags.append(f"{material_col.strip()} is blank in the source")
    return flags


def _time_s(cell: str) -> int | None:
    s = (cell or "").strip()
    if m := re.fullmatch(r"(\d{1,2})[:.](\d{2})[:.](\d{2})", s):
        h, mi, se = map(int, m.groups())
    elif re.fullmatch(r"\d{4}", s):
        h, mi, se = int(s[:2]), int(s[2:]), 0
    else:
        return None
    return h * 3600 + mi * 60 + se if h < 24 and mi < 60 and se < 60 else None


def _spice_flags(row: dict[str, str]) -> list[str]:
    """SPICE (PSI-107): ignition / flame-off clock times (nasa102-159final.ipynb, step 1.2)."""
    ign_h = next((h for h in row if "ignition" in h.lower()), None)
    off_h = next((h for h in row if "flame off" in re.sub(r"\s+", " ", h.lower())), None)
    flags = []
    for h in (ign_h, off_h):
        if h and not _blank(row[h]) and _time_s(row[h]) is None:
            flags.append(f"{h.strip()} holds a note ('{row[h].strip()}'), not a time")
    if ign_h and off_h:
        a, b = _time_s(row[ign_h]), _time_s(row[off_h])
        if a is not None and b is not None and (b - a <= 0 or b - a > 1800):
            flags.append(f"flame-off ({row[off_h].strip()}) is not 0-30 min after ignition ({row[ign_h].strip()}); burn time suspect")
    return flags


def material_label(psi_id: str, row: dict[str, str], material_col: str | None) -> tuple[str | None, list[str]]:
    """(label, flags). Label is None when unchanged from the CSV cell."""
    if not material_col:
        return None, []
    raw = (row.get(material_col) or "").strip()
    if not raw:
        return None, []
    label, flags = PERCENT_SPACING.sub(r"\1% ", raw), []
    for pattern, species in FILL_SERIES.get(psi_id, []):
        if pattern.search(label):
            fixed = pattern.sub(species, label)
            flags.append(f"{material_col.strip()} '{raw}' is a spreadsheet fill-series artifact "
                         f"(no such gas); read as '{fixed}'")
            label = fixed
    return (label if label != raw else None), flags


def clean_table(psi_id: str, headers: list[str], rows: list[dict[str, str]],
                material_col: str | None = None) -> CleanTable:
    kept, excluded, notes = [], [], []
    seen: dict[tuple, int] = {}
    for i, row in enumerate(rows, start=1):
        reason = _classify(row, headers)
        if reason:
            excluded.append({"row": i, "reason": reason, "text": _row_text(row)[:240]})
            if reason.startswith(("footnote", "note")):
                note_text = " ".join(v.strip() for h, v in row.items() if not _blank(v))
                notes.append(note_text)
            continue
        key = tuple((h, (row.get(h) or "").strip()) for h in headers)
        if key in seen:
            excluded.append({"row": i, "reason": f"exact duplicate of row {seen[key]}", "text": _row_text(row)[:240]})
            continue
        seen[key] = i
        flags = _flags(psi_id, row, material_col)
        if psi_id == "PSI-107":
            flags += _spice_flags(row)
        label, label_flags = material_label(psi_id, row, material_col)
        kept.append(CleanRow(row=i, cells=row, flags=flags + label_flags, material_label=label))
    # "Notes" columns (PSI-20/21/22/23) carry table-wide explanations: keep each distinct one once.
    # Per-test "Comments" (CFI-G) stay with their rows.
    for h in headers:
        if re.fullmatch(r"notes?", h.strip(), re.I):
            for row in rows:
                text = (row.get(h) or "").strip()
                if text and text not in notes and not any(text in n for n in notes):
                    notes.append(text)
    return CleanTable(rows=kept, excluded=excluded, notes=notes)
