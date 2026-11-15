// The Chart of the Evidence: every experimental-table row placed by tested oxygen and pressure.
// Pure functions over explorer.json (Python-exported, unit-converted rows); no value is estimated.
// A row with a range is placed by the midpoint of its range; rows without a value are counted, never placed.

import type { ExplorerRow, FuelPhase, Range } from "./types";

export type Family = Exclude<FuelPhase, "mixed"> | "unknown";

/** Oxygen columns (% by volume). Narrow where the tests cluster (20–22 holds air), wide where they are sparse. */
export const O2_EDGES = [10, 15, 20, 22, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 100];
/** Pressure rows (psi). 10.2 and 14–15 are edges on purpose: Moon base ≤ 10.2, ISS 14.7. */
export const P_EDGES = [0, 5, 10.2, 14, 15, 20, 30, 50, 75];

export interface Cell {
  o2: number; // column index
  p: number; // row index (0 = lowest pressure)
  count: number;
  families: Family[]; // distinct, in a fixed order
  investigations: { psi_id: string; count: number }[];
}

export interface Strip {
  o2: number;
  count: number;
  families: Family[];
  investigations: { psi_id: string; count: number }[];
}

export interface Region {
  key: string;
  label: string;
  rule: string; // human-readable condition
  o2: [number, number]; // inclusive column span
  p: [number, number]; // inclusive row span
  count: number;
  families: Record<Family, number>;
  investigations: { psi_id: string; count: number }[];
}

export interface Evidence {
  o2Edges: number[];
  pEdges: number[];
  cells: Cell[];
  strip: Strip[]; // oxygen reported, pressure not
  noO2: { psi_id: string; count: number }[]; // rows without oxygen
  totals: { rows: number; placed: number; o2Only: number; noO2: number; investigationsPlaced: number };
  regions: Record<string, Region>;
}

const FAMILY_ORDER: Family[] = ["solid", "liquid_droplet", "gas", "unknown"];

export function binIndex(edges: number[], v: number): number {
  for (let i = 0; i < edges.length - 1; i++) {
    const last = i === edges.length - 2;
    if (v >= edges[i] && (v < edges[i + 1] || (last && v <= edges[i + 1]))) return i;
  }
  return -1;
}

const mid = (r: Range) => (r ? (r[0] + r[1]) / 2 : null);

function tally(rows: ExplorerRow[], familyOf: (id: string) => Family) {
  const by = new Map<string, number>();
  const fam = new Set<Family>();
  for (const r of rows) {
    by.set(r.psi_id, (by.get(r.psi_id) ?? 0) + 1);
    fam.add(familyOf(r.psi_id));
  }
  return {
    investigations: [...by].map(([psi_id, count]) => ({ psi_id, count })).sort((a, b) => b.count - a.count),
    families: FAMILY_ORDER.filter((f) => fam.has(f)),
  };
}

/** Habitat regions on the chart (challenge brief presets). Counts use exact row values, not cells. */
const REGIONS: { key: string; label: string; rule: string; test: (o2: number, p: number) => boolean; o2: [number, number]; p: [number, number] }[] = [
  {
    key: "iss_cabin",
    label: "ISS cabin",
    rule: "20–22% O₂ at 14–15 psi (air at 21%, 14.7 psi)",
    test: (o2, p) => o2 >= 20 && o2 < 22 && p >= 14 && p < 15,
    o2: [binIndex(O2_EDGES, 21), binIndex(O2_EDGES, 21)],
    p: [binIndex(P_EDGES, 14.7), binIndex(P_EDGES, 14.7)],
  },
  {
    key: "moon_base",
    label: "Moon base / pressurized rover",
    rule: "≥ 30% O₂ at ≤ 10.2 psi",
    test: (o2, p) => o2 >= 30 && p <= 10.2,
    o2: [binIndex(O2_EDGES, 30), O2_EDGES.length - 2],
    p: [0, binIndex(P_EDGES, 10)],
  },
  {
    key: "spacesuit",
    label: "Spacesuit",
    rule: "≥ 95% O₂ at ≤ 5 psi (suit: 100% O₂, 4.3 psi)",
    test: (o2, p) => o2 >= 95 && p <= 5,
    o2: [binIndex(O2_EDGES, 97), binIndex(O2_EDGES, 97)],
    p: [0, 0],
  },
];

export function buildEvidence(rows: ExplorerRow[], familyOf: (id: string) => Family): Evidence {
  const placed: { row: ExplorerRow; o2: number; p: number; ci: number; pi: number }[] = [];
  const o2Only: { row: ExplorerRow; ci: number }[] = [];
  const noO2: ExplorerRow[] = [];
  for (const row of rows) {
    const o2 = mid(row.o2);
    const p = mid(row.pressure);
    if (o2 === null) {
      noO2.push(row);
      continue;
    }
    const ci = binIndex(O2_EDGES, o2);
    if (ci < 0) continue; // outside the chart's 10–100% span (none in the current data)
    if (p === null) {
      o2Only.push({ row, ci });
      continue;
    }
    const pi = binIndex(P_EDGES, p);
    if (pi < 0) continue;
    placed.push({ row, o2, p, ci, pi });
  }

  const cellMap = new Map<string, ExplorerRow[]>();
  for (const x of placed) {
    const k = `${x.ci}:${x.pi}`;
    if (!cellMap.has(k)) cellMap.set(k, []);
    cellMap.get(k)!.push(x.row);
  }
  const cells: Cell[] = [...cellMap].map(([k, rs]) => {
    const [o2, p] = k.split(":").map(Number);
    return { o2, p, count: rs.length, ...tally(rs, familyOf) };
  });

  const stripMap = new Map<number, ExplorerRow[]>();
  for (const x of o2Only) {
    if (!stripMap.has(x.ci)) stripMap.set(x.ci, []);
    stripMap.get(x.ci)!.push(x.row);
  }
  const strip: Strip[] = [...stripMap].map(([o2, rs]) => ({ o2, count: rs.length, ...tally(rs, familyOf) }));

  const regions = Object.fromEntries(
    REGIONS.map((reg) => {
      const inside = placed.filter((x) => reg.test(x.o2, x.p)).map((x) => x.row);
      const t = tally(inside, familyOf);
      const families = Object.fromEntries(FAMILY_ORDER.map((f) => [f, inside.filter((r) => familyOf(r.psi_id) === f).length])) as Record<Family, number>;
      return [reg.key, { key: reg.key, label: reg.label, rule: reg.rule, o2: reg.o2, p: reg.p, count: inside.length, families, investigations: t.investigations }];
    }),
  );

  return {
    o2Edges: O2_EDGES,
    pEdges: P_EDGES,
    cells,
    strip,
    noO2: tally(noO2, familyOf).investigations,
    totals: {
      rows: rows.length,
      placed: placed.length,
      o2Only: o2Only.length,
      noO2: noO2.length,
      investigationsPlaced: new Set(placed.map((x) => x.row.psi_id)).size,
    },
    regions,
  };
}
