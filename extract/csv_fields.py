"""Experimental-table CSVs -> test rows and numeric [min, max] ranges. Pure functions, no LLM.

A range is only filled when the column and its unit are unambiguous. Anything else becomes
`None` plus a note, and the notes end up in extract/REVIEW.md for a human to check.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from pathlib import Path

# "21.5 - 21.7" -> 21.5, 21.7 (spaced dash is a separator); the 2 in "LOW O2" / "N2" is not a number.
NUMBER = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?")

PRESSURE_TO_PSI = {"psia": 1.0, "psi": 1.0, "kpa": 0.145038, "atm": 14.6959, "bar": 14.5038,
                   "torr": 0.0193368, "mmhg": 0.0193368}
AIRFLOW_TO_CM_S = {"cm/s": 1.0, "mm/s": 0.1, "m/s": 100.0}
MASS_OR_VOLUME_FLOW = re.compile(r"mg/s|g/s|sccm|slpm|lpm|kg|mass|\brate\b.*\(mg|flow rate", re.I)
FINAL = re.compile(r"final|after", re.I)

# PSI's FLEX table (PSI-69) lost the subscript in "O2" when exported; the values are O2 mole
# fractions (0.21 = air). Listed explicitly so it is visible, and flagged in REVIEW.md.
O2_HEADER_ALIASES = {"o initial ambient composition; mole fraction"}

# Physically impossible values are dropped (and noted), never "fixed".
VALID = {"o2": (0.0, 100.0), "pressure": (0.0, None), "airflow": (0.0, None)}
STRICT_LOW = {"pressure"}  # 0 psi is a placeholder, not a test condition


@dataclass
class RangeResult:
    value: list[float] | None = None
    columns: list[str] = field(default_factory=list)  # "csv:<file>:<header>"
    notes: list[str] = field(default_factory=list)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    """Headers (stripped) and non-blank rows as {header: cell string}, cells exactly as in the CSV."""
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return [], []
    headers = [h.strip() for h in rows[0]]
    out = []
    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        record = {h: (row[i] if i < len(row) else "") for i, h in enumerate(headers) if h}
        out.append(record)
    return [h for h in headers if h], out


def parse_numbers(cell: str) -> list[float]:
    """All numbers in a cell. Blank, '-', 'N/A' -> []."""
    return [float(n) for n in NUMBER.findall(cell or "")]


# --- column matching -------------------------------------------------------------------------

def is_o2_column(header: str) -> bool:
    h = header.lower()
    if h in O2_HEADER_ALIASES:
        return True
    if "co2" in h or MASS_OR_VOLUME_FLOW.search(h):
        return False
    return "o2" in h or "oxygen" in h


def is_pressure_column(header: str) -> bool:
    h = header.lower()
    return "pressure" in h or bool(re.match(r"^(approx\s+)?p(init|final|mean)?\s*\(", h))


def is_airflow_column(header: str) -> bool:
    h = header.lower()
    if "fuel" in h or MASS_OR_VOLUME_FLOW.search(h):
        return False
    # "velocity": SAME-R (PSI-101) reports airflow as "Inlet velocity (cm/s)".
    return "flow" in h or "air" in h or "velocity" in h


def pressure_unit(text: str) -> str | None:
    t = text.lower()
    for unit in ("psia", "psi", "kpa", "atm", "bar", "torr", "mmhg"):
        if re.search(rf"(?<![a-z]){unit}(?![a-z])", t):
            return unit
    return None


def airflow_unit(text: str) -> str | None:
    t = text.lower()
    for unit in ("cm/s", "mm/s", "m/s"):  # cm/s and mm/s before m/s
        if re.search(rf"(?<![a-z]){re.escape(unit)}", t):
            return unit
    return None


def convert_pressure(value: float, unit: str | None) -> float | None:
    factor = PRESSURE_TO_PSI.get((unit or "").lower())
    return None if factor is None else value * factor


def convert_airflow(value: float, unit: str | None) -> float | None:
    factor = AIRFLOW_TO_CM_S.get((unit or "").lower())
    return None if factor is None else value * factor


def o2_is_fraction(header: str, values: list[float]) -> bool:
    h = header.lower()
    return "fraction" in h or (bool(values) and all(v <= 1 for v in values))


# --- ranges ----------------------------------------------------------------------------------

def _column_values(header: str, rows: list[dict[str, str]], kind: str) -> tuple[list[float], str | None]:
    """Numbers of one column in the target unit, or ([], reason) if the unit is unclear."""
    cells = [r.get(header, "") for r in rows]
    numbered = [(c, parse_numbers(c)) for c in cells if parse_numbers(c)]
    if not numbered:
        return [], None
    if kind == "o2":
        nums = [n for _, ns in numbered for n in ns]
        scale = 100.0 if o2_is_fraction(header, nums) else 1.0
        return [n * scale for n in nums], None
    unit_of, convert = (pressure_unit, convert_pressure) if kind == "pressure" else (airflow_unit, convert_airflow)
    header_unit = unit_of(header)
    out = []
    for cell, nums in numbered:
        unit = header_unit or unit_of(cell)
        if unit is None:
            return [], f"unit unclear in column '{header}' (e.g. '{cell.strip()}')"
        out += [convert(n, unit) for n in nums]
    return out, None


def find_range(kind: str, tables: list[tuple[str, list[str], list[dict[str, str]]]]) -> RangeResult:
    """kind: 'o2' | 'pressure' | 'airflow'. tables: (file_name, headers, rows)."""
    matcher = {"o2": is_o2_column, "pressure": is_pressure_column, "airflow": is_airflow_column}[kind]
    result = RangeResult()
    values: list[float] = []
    for file_name, headers, rows in tables:
        matched = [h for h in headers if matcher(h)]
        # Test conditions are the initial state: ignore "final"/"after" columns when others exist.
        if any(not FINAL.search(h) for h in matched):
            matched = [h for h in matched if not FINAL.search(h)]
        for header in matched:
            col, problem = _column_values(header, rows, kind)
            if problem:
                result.notes.append(f"{file_name}: {problem}")
                continue
            if not col:
                continue
            low, high = VALID[kind]
            good = [v for v in col if (v > low if kind in STRICT_LOW else v >= low) and (high is None or v <= high)]
            if len(good) < len(col):
                bad = sorted({round(v, 4) for v in col if v not in good})
                result.notes.append(f"{file_name}: dropped impossible {kind} values {bad[:6]} in '{header}'")
            if header.lower() in O2_HEADER_ALIASES:
                result.notes.append(f"{file_name}: '{header}' read as O2 mole fraction (subscript lost in PSI file)")
            if good:
                values += good
                result.columns.append(f"csv:{file_name}:{header}")
    if values:
        result.value = [round(min(values), 4), round(max(values), 4)]
    return result
