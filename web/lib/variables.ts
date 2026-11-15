// How tests within one investigation differed and what they shared (challenge brief: "Variables:
// how did tests from the same investigation differ and how were they the same?"). Pure functions over
// the experimental-table rows exactly as NASA published them; nothing is inferred.

export interface ColumnSummary {
  column: string;
  distinct: string[]; // distinct non-blank cell values, in first-seen order
  blank: number; // rows with an empty cell
}

export interface TableVariables {
  table: string;
  rows: number;
  varied: ColumnSummary[]; // 2+ distinct values
  constant: ColumnSummary[]; // exactly 1 distinct value
  empty: string[]; // never filled in
}

// Bookkeeping columns: they always differ, so they say nothing about the test design.
const BOOKKEEPING = /^(date|test date|gmt|gmt date|local time|year|month|day|test day\*?|actual day|time|test gmt|test|sample number|sample #|test #|as run test #|flex test #|flex number|flex identifier|same test #|data id|session name|camera \d|figure id in reference|reference publication link)$/i;

export function isBookkeeping(column: string): boolean {
  return BOOKKEEPING.test(column.trim());
}

export function summarizeTable(table: string, rows: Record<string, string>[]): TableVariables {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => c !== "_table");
  const summaries = columns.map((column) => {
    const seen = new Set<string>();
    let blank = 0;
    for (const r of rows) {
      const v = (r[column] ?? "").trim();
      if (v) seen.add(v);
      else blank++;
    }
    return { column, distinct: [...seen], blank };
  });
  return {
    table,
    rows: rows.length,
    varied: summaries.filter((s) => s.distinct.length > 1),
    constant: summaries.filter((s) => s.distinct.length === 1),
    empty: summaries.filter((s) => s.distinct.length === 0).map((s) => s.column),
  };
}

// Sample or burner geometry columns (same rule as scripts/export_web.py SIZE_HEADERS).
const SIZE = /thick|samle thick|sample length|sample width|initial diameter|nozzle|burner size/i;

/** "Sample Thickness (cm): 0.37, 0.33" lines for the fuel sample / burner geometry, from the CSV cells. */
export function sampleSizes(rows: Record<string, string>[], max = 4): { column: string; values: string[]; more: number }[] {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => SIZE.test(c));
  return columns
    .map((column) => {
      const distinct = [...new Set(rows.map((r) => (r[column] ?? "").trim()).filter(Boolean))];
      return { column: column.trim(), values: distinct.slice(0, max), more: Math.max(0, distinct.length - max) };
    })
    .filter((c) => c.values.length);
}
