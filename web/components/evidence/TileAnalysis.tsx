"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { fmtNumber } from "@/lib/format";
import type { ExplorerData, ExplorerRow, Range } from "@/lib/types";

// explorer.json is fetched once per page view and shared by every tile.
let cache: Promise<ExplorerData> | null = null;
const loadExplorer = () =>
  (cache ??= fetch("/data/explorer").then((r) => (r.ok ? (r.json() as Promise<ExplorerData>) : Promise.reject(new Error("load failed")))));

function span(rows: ExplorerRow[], key: "o2" | "pressure" | "airflow"): Range {
  const vals = rows.flatMap((r) => (r[key] ? [r[key]![0], r[key]![1]] : []));
  return vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
}
const fmt = (r: Range, unit: string) => (r ? (r[0] === r[1] ? `${fmtNumber(r[0])} ${unit}` : `${fmtNumber(r[0])}–${fmtNumber(r[1])} ${unit}`) : null);

function distinctLevels(rows: ExplorerRow[], key: "o2" | "pressure"): number {
  return new Set(rows.flatMap((r) => (r[key] ? [`${r[key]![0]}-${r[key]![1]}`] : []))).size;
}

/** Analysis of one investigation's cleaned test rows (extract/row_clean.py), shown under the element table. */
export function TileAnalysis({ psiId, name, doi, score, habitat, onClose }: { psiId: string; name: string; doi: string; score: string; habitat: string; onClose: () => void }) {
  const [data, setData] = useState<ExplorerData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadExplorer().then(setData).catch(() => setError(true));
  }, []);

  const tables = data ? Object.entries(data.tables).filter(([, t]) => t.psi_id === psiId) : [];
  const rows = data ? data.rows.filter((r) => r.psi_id === psiId) : [];
  const csvRows = tables.reduce((n, [, t]) => n + t.csv_rows, 0);
  const excluded = tables.flatMap(([, t]) => t.excluded);
  const reasons = [...excluded.reduce((m, e) => {
    const k = e.reason.startsWith("exact duplicate") ? "exact duplicates" : e.reason;
    return m.set(k, (m.get(k) ?? 0) + 1);
  }, new Map<string, number>())];
  const flagged = rows.filter((r) => r.flags?.length);
  const notes = tables.flatMap(([, t]) => t.notes);
  const materials = [...rows.reduce((m, r) => (r.material ? m.set(r.material, (m.get(r.material) ?? 0) + 1) : m), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const placed = rows.filter((r) => r.o2 && r.pressure).length;
  const outcomeCols = [...new Set(tables.flatMap(([, t]) => t.outcome_columns))];
  const sizeCols = [...new Set(tables.flatMap(([, t]) => t.size_columns))];
  const conditions: [string, string | null, string][] = [
    ["Oxygen", fmt(span(rows, "o2"), "% O₂"), rows.filter((r) => r.o2).length ? `${distinctLevels(rows, "o2")} distinct levels in ${rows.filter((r) => r.o2).length} rows` : ""],
    ["Pressure", fmt(span(rows, "pressure"), "psi"), rows.filter((r) => r.pressure).length ? `${distinctLevels(rows, "pressure")} distinct levels in ${rows.filter((r) => r.pressure).length} rows` : ""],
    ["Airflow", fmt(span(rows, "airflow"), "cm/s"), rows.filter((r) => r.airflow).length ? `${rows.filter((r) => r.airflow).length} rows` : ""],
  ];

  return (
    <section aria-label={`Analysis of ${name}`} className="border-2 border-rule bg-bg p-4 sm:p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">{psiId} · DOI {doi}</p>
          <h3 className="text-lg font-semibold text-ink">{name}: what its cleaned data shows</h3>
          <p className="text-sm text-muted">
            Score {score} for {habitat.toLowerCase()}. Read from NASA&apos;s experimental table after the row-by-row cleaning; nothing is estimated.
          </p>
        </div>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center hover:bg-panel-2" aria-label="Close analysis">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-muted">Could not load the test rows. Open the full page instead.</p> : null}
      {!data && !error ? <p role="status" className="mt-3 text-sm text-muted">Loading its test rows…</p> : null}

      {data && !tables.length ? (
        <p className="cell-empty mt-4 border border-rule p-4 text-sm text-body">
          NASA has no experimental table in PSI for this investigation, so there is no test data to clean or analyze. Its record comes from
          NASA&apos;s text only.
        </p>
      ) : null}

      {data && tables.length ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          <div>
            <h4 className="text-sm font-semibold text-ink">Cleaning</h4>
            <p className="tabular mt-1 text-sm text-body">
              {csvRows.toLocaleString("en-US")} CSV rows → <span className="font-semibold">{rows.length.toLocaleString("en-US")} test rows</span>
            </p>
            {reasons.length ? (
              <ul className="mt-1.5 space-y-0.5 text-sm text-muted">
                {reasons.map(([k, n]) => (
                  <li key={k}>
                    {n} set aside: {k}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-muted">Every row is a test; nothing set aside.</p>
            )}
            <p className="mt-1.5 text-sm text-muted">
              {flagged.length ? `${flagged.length} kept row${flagged.length === 1 ? "" : "s"} flagged (e.g. ${flagged[0].flags![0]})` : "No kept row needed a flag."}
            </p>
            {notes.length ? <p className="mt-1.5 text-sm text-muted">{notes.length} note{notes.length === 1 ? "" : "s"} from NASA kept with the table.</p> : null}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-ink">Test conditions</h4>
            <dl className="mt-1 space-y-1 text-sm">
              {conditions.map(([label, value, detail]) => (
                <div key={label}>
                  <dt className="inline text-muted">{label}: </dt>
                  <dd className="inline">
                    {value ? <span className="tabular font-medium text-ink">{value}</span> : <span className="text-faint">not reported</span>}
                    {detail ? <span className="text-muted"> ({detail})</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 text-sm text-muted">
              {placed ? `${placed} of ${rows.length} rows report both oxygen and pressure, so they sit on the chart above.` : "No row reports both oxygen and pressure, so none sit on the chart above."}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-ink">Samples and results</h4>
            {materials.length ? (
              <ul className="mt-1 space-y-0.5 text-sm">
                {materials.slice(0, 6).map(([m, n]) => (
                  <li key={m} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-ink" title={m}>{m}</span>
                    <span className="tabular shrink-0 text-muted">{n}</span>
                  </li>
                ))}
                {materials.length > 6 ? <li className="text-muted">+{materials.length - 6} more</li> : null}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-faint">No material or fuel column in the table.</p>
            )}
            <p className="mt-1.5 text-sm text-muted">
              {sizeCols.length ? `Sample size: ${sizeCols.join(", ")}. ` : ""}
              {outcomeCols.length ? `Results recorded: ${outcomeCols.join(", ")}.` : "No result column (ignition, burn time, spread rate) in the table."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3 text-sm">
        <Link href={`/investigations/${psiId}`} className="text-ion underline underline-offset-2">Full investigation page</Link>
        {tables.length ? (
          <>
            {excluded.length || flagged.length || notes.length ? (
              <Link href={`/investigations/${psiId}#cleaning`} className="text-ion underline underline-offset-2">Every cleaning note</Link>
            ) : null}
            <Link href={`/explorer?inv=${psiId}`} className="text-ion underline underline-offset-2">Its rows in the Data Explorer</Link>
            <a href={`/data/tables/${psiId}.csv`} download className="inline-flex items-center gap-1 text-ion underline underline-offset-2">
              <Download aria-hidden className="h-3.5 w-3.5" /> Cleaned table (CSV)
            </a>
          </>
        ) : null}
      </div>
    </section>
  );
}
