"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Download, FileJson, Search } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { fmtRange, PHASE_COLOR, PHASE_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { ExplorerData, ExplorerRow, FuelPhase, Pillar, Range, Scenario } from "@/lib/types";

export interface ExplorerInvestigation {
  psi_id: string;
  name: string;
  doi: string;
  phase: FuelPhase | "unknown";
  pillars: Pillar[];
}

type YKey = "pressure" | "airflow";
type Need = "o2" | "pressure" | "airflow";
const PAGE = 25;
const PHASES: (FuelPhase | "unknown")[] = ["solid", "liquid_droplet", "gas", "unknown"];
const PHASE_NAME = (p: FuelPhase | "unknown") => (p === "unknown" ? "Mixed / unknown" : PHASE_LABEL[p]);
const PHASE_FILL = (p: FuelPhase | "unknown") => (p === "unknown" ? PHASE_COLOR.mixed : PHASE_COLOR[p]);

const mid = (r: Range) => (r ? (r[0] + r[1]) / 2 : null);
const cellRange = (r: Range, unit: string) => (r ? fmtRange(r, unit) : "");

interface Point {
  x: number;
  y: number;
  row: ExplorerRow;
  name: string;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function DataExplorer({ investigations, scenarios }: { investigations: ExplorerInvestigation[]; scenarios: Scenario[] }) {
  const [data, setData] = useState<ExplorerData | null>(null);
  const [error, setError] = useState(false);
  // Filters live in the URL (?inv=&fuel=&pillar=&q=&need=o2,airflow&y=airflow): shareable, and Back/Forward work.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inv = params.get("inv") ?? "all";
  const phase = params.get("fuel") ?? "all";
  const pillar = params.get("pillar") ?? "all";
  const y: YKey = params.get("y") === "airflow" ? "airflow" : "pressure";
  const needs = useMemo(
    () => new Set((params.get("need") ?? "").split(",").filter((n): n is Need => n === "o2" || n === "pressure" || n === "airflow")),
    [params],
  );
  const [q, setQState] = useState(params.get("q") ?? "");
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "" || value === "all" || (key === "y" && value === "pressure")) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const setInv = (v: string) => setParam("inv", v);
  const setPhase = (v: string) => setParam("fuel", v);
  const setPillar = (v: string) => setParam("pillar", v);
  const setY = (v: YKey) => setParam("y", v);
  const setQ = (v: string) => {
    setQState(v);
    setParam("q", v.trim() || null);
  };
  const setNeeds = (fn: (s: Set<Need>) => Set<Need>) => setParam("need", [...fn(needs)].sort().join(",") || null);
  const [paging, setPaging] = useState({ key: "", page: 0 });

  useEffect(() => {
    fetch("/data/explorer")
      .then((r) => (r.ok ? (r.json() as Promise<ExplorerData>) : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const byId = useMemo(() => new Map(investigations.map((i) => [i.psi_id, i])), [investigations]);
  const withTables = useMemo(() => investigations.filter((i) => data?.rows.some((r) => r.psi_id === i.psi_id)), [investigations, data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.rows.filter((r) => {
      const i = byId.get(r.psi_id)!;
      if (inv !== "all" && r.psi_id !== inv) return false;
      if (phase !== "all" && i.phase !== phase) return false;
      if (pillar !== "all" && !(pillar === "none" ? i.pillars.length === 0 : i.pillars.includes(pillar as Pillar))) return false;
      for (const n of needs) if (!r[n]) return false;
      if (needle && !`${r.material ?? ""} ${r.size ?? ""} ${r.outcomes ?? ""} ${i.name} ${r.psi_id}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, byId, inv, phase, pillar, needs, q]);

  // Back to the first page whenever the filters change.
  const filterKey = [inv, phase, pillar, [...needs].sort().join("+"), q].join("|");
  const page = paging.key === filterKey ? paging.page : 0;
  const setPage = (next: (p: number) => number) => setPaging({ key: filterKey, page: next(page) });

  const series = useMemo(
    () =>
      PHASES.map((p) => ({
        phase: p,
        points: rows
          .filter((r) => byId.get(r.psi_id)!.phase === p && r.o2 && r[y])
          .map((r) => ({ x: mid(r.o2)!, y: mid(r[y])!, row: r, name: byId.get(r.psi_id)!.name })),
      })).filter((s) => s.points.length),
    [rows, byId, y],
  );
  const plotted = series.reduce((n, s) => n + s.points.length, 0);
  const counts = {
    o2: rows.filter((r) => r.o2).length,
    pressure: rows.filter((r) => r.pressure).length,
    airflow: rows.filter((r) => r.airflow).length,
  };
  const scenarioDots =
    y === "pressure"
      ? [...new Map(scenarios.map((s) => [`${s.o2_percent}-${s.pressure_psi}`, s])).values()].map((s) => ({
          x: s.o2_percent,
          y: s.pressure_psi,
          label: scenarios
            .filter((t) => t.o2_percent === s.o2_percent && t.pressure_psi === s.pressure_psi)
            .map((t) => t.label.split(" (")[0].split(" /")[0])
            .join(" / "),
        }))
      : [];

  function exportRows(kind: "csv" | "json") {
    const out = rows.map((r) => {
      const i = byId.get(r.psi_id)!;
      return {
        psi_id: r.psi_id,
        investigation: i.name,
        doi: i.doi,
        table: r.table,
        row: r.row,
        material: r.material,
        sample_size: r.size,
        o2_percent_min: r.o2?.[0] ?? null,
        o2_percent_max: r.o2?.[1] ?? null,
        pressure_psi_min: r.pressure?.[0] ?? null,
        pressure_psi_max: r.pressure?.[1] ?? null,
        airflow_cm_s_min: r.airflow?.[0] ?? null,
        airflow_cm_s_max: r.airflow?.[1] ?? null,
        outcomes: r.outcomes,
        source: `https://psi.nasa.gov/physci/repo/data/investigations/${r.psi_id}`,
      };
    });
    if (kind === "json") return download("nasa_psi_combustion_tests.json", JSON.stringify(out, null, 2), "application/json");
    const header = Object.keys(out[0] ?? { psi_id: "" });
    const text = [header, ...out.map((o) => header.map((h) => o[h as keyof typeof o]))].map((l) => l.map(csvCell).join(",")).join("\r\n");
    download("nasa_psi_combustion_tests.csv", text + "\r\n", "text/csv");
  }

  if (error) return <p className="border border-rule bg-panel p-6 text-muted">Could not load the test rows. Please reload the page.</p>;

  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  // 16px text on phones (no iOS zoom), 14px from sm up; 40px tall controls (DESIGN.md text-input).
  const select = "h-10 w-full rounded-lg border border-line bg-panel px-3 text-base text-ink sm:text-sm";
  const fieldLabel = "text-xs font-semibold text-muted";

  return (
    <div className="space-y-6">
      <section aria-label="Filters" className="grid gap-4 border border-rule bg-panel p-5 sm:grid-cols-2 xl:grid-cols-5">
        <label className={fieldLabel}>
          Investigation
          <select value={inv} onChange={(e) => setInv(e.target.value)} className={`mt-1.5 normal-case tracking-normal ${select}`}>
            <option value="all">All with test tables ({withTables.length || "…"})</option>
            {withTables.map((i) => (
              <option key={i.psi_id} value={i.psi_id}>
                {i.name} ({i.psi_id})
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Fuel type
          <select value={phase} onChange={(e) => setPhase(e.target.value)} className={`mt-1.5 normal-case tracking-normal ${select}`}>
            <option value="all">All fuel types</option>
            {PHASES.map((p) => (
              <option key={p} value={p}>{PHASE_NAME(p)}</option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Fire-safety pillar
          <select value={pillar} onChange={(e) => setPillar(e.target.value)} className={`mt-1.5 normal-case tracking-normal ${select}`}>
            <option value="all">All pillars</option>
            {(["prevention", "detection", "suppression"] as Pillar[]).map((p) => (
              <option key={p} value={p}>{PILLAR_LABEL[p]}</option>
            ))}
            <option value="none">No pillar (basic science)</option>
          </select>
        </label>
        <label className={fieldLabel}>
          Search
          <span className="relative mt-1.5 block normal-case tracking-normal">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Nomex, PMMA, heptane…" spellCheck={false} autoComplete="off" className={`${select} pl-9 placeholder:text-faint`} />
          </span>
        </label>
        <fieldset className={fieldLabel}>
          <legend>Only rows that report</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 normal-case tracking-normal">
            {(["o2", "pressure", "airflow"] as Need[]).map((n) => (
              <label key={n} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={needs.has(n)}
                  onChange={() =>
                    setNeeds((s) => {
                      const next = new Set(s);
                      if (next.has(n)) next.delete(n);
                      else next.add(n);
                      return next;
                    })
                  }
                  className="h-4 w-4 accent-[var(--color-flame-fill)]"
                />
                {n === "o2" ? "O₂" : n === "pressure" ? "Pressure" : "Airflow"}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-label="Matching rows" aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Matching test rows", data ? rows.length.toLocaleString("en-US") : "…", `of ${data ? data.rows.length.toLocaleString("en-US") : "…"} in NASA's tables`],
          ["Report oxygen", counts.o2.toLocaleString("en-US"), "rows with an O₂ value"],
          ["Report pressure", counts.pressure.toLocaleString("en-US"), "rows with a pressure value"],
          ["Report airflow", counts.airflow.toLocaleString("en-US"), "rows with an airflow value"],
        ].map(([l, v, d]) => (
          <div key={l} className="border border-rule bg-panel p-5">
            <p className="text-sm font-medium text-muted">{l}</p>
            <p className="font-semibold tabular mt-2 text-4xl leading-none text-ink">{v}</p>
            <p className="mt-1 text-xs text-faint">{d}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="scatter-title" className="border border-rule bg-panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="scatter-title" className="text-lg font-medium">Test conditions: where NASA has data</h2>
            <p className="mt-0.5 text-sm text-muted">
              Each dot is one test row. {plotted.toLocaleString("en-US")} of the matching rows report both oxygen and {y}.
              {y === "pressure" ? " Rings mark each habitat's oxygen and pressure; empty areas were never tested." : ""}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-panel-2 p-1" role="group" aria-label="Vertical axis">
            {(["pressure", "airflow"] as YKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setY(k)}
                aria-pressed={y === k}
                className={`min-h-8 rounded-lg px-3 py-1 text-sm font-medium ${y === k ? "bg-rule text-white" : "text-muted hover:text-ink"}`}
              >
                O₂ vs {k}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[380px] w-full" role="img" aria-label={`Scatter plot of oxygen percent against ${y} for ${plotted} test rows, coloured by fuel type.`}>
          {data ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 8 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Oxygen"
                  unit="%"
                  domain={[0, 100]}
                  ticks={[0, 21, 30, 50, 75, 100]}
                  tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                  label={{ value: "Oxygen (% by volume)", position: "insideBottom", offset: -16, fill: "var(--color-muted)", fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={y}
                  tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                  label={{ value: y === "pressure" ? "Pressure (psi)" : "Airflow (cm/s)", angle: -90, position: "insideLeft", offset: 14, fill: "var(--color-muted)", fontSize: 12 }}
                />
                <ZAxis range={[36, 36]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "var(--color-line)" }}
                  content={({ active, payload }) => {
                    const p = active && payload?.length ? (payload[0].payload as Point) : null;
                    if (!p) return null;
                    return (
                      <div className="max-w-72 rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-pop">
                        <p className="font-semibold text-ink">
                          {p.name} <span className="font-mono font-normal text-faint">{p.row.psi_id} · row {p.row.row}</span>
                        </p>
                        {p.row.material ? <p className="text-muted">{p.row.material}</p> : null}
                        <p className="mt-1 font-mono text-ink">
                          {fmtRange(p.row.o2, "% O₂")} · {fmtRange(p.row[y], y === "pressure" ? "psi" : "cm/s")}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={28}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string) => <span style={{ color: "var(--color-body)" }}>{value}</span>}
                />
                {series.map((s) => (
                  <Scatter key={s.phase} name={PHASE_NAME(s.phase)} data={s.points} fill={PHASE_FILL(s.phase)} fillOpacity={0.9} stroke="#111111" strokeWidth={0.6} isAnimationActive={false} />
                ))}
                {scenarioDots.map((d) => (
                  <ReferenceDot
                    key={d.label}
                    x={d.x}
                    y={d.y}
                    r={9}
                    fill="none"
                    stroke="var(--color-flame-fill)"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                    label={{ value: d.label, position: d.x > 80 ? "left" : "top", fill: "var(--color-flame)", fontSize: 11, offset: 12 }}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <p role="status" className="grid h-full place-items-center text-muted">Loading 2,000+ test rows…</p>
          )}
        </div>
      </section>

      <section aria-labelledby="rows-title" className="border border-rule bg-panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="rows-title" className="text-lg font-medium">Test rows</h2>
            <p className="mt-0.5 text-sm text-muted">
              Values converted to %, psi and cm/s from NASA&apos;s CSV columns. Blank = not reported. Downloads include each row&apos;s PSI ID and DOI.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={!rows.length} onClick={() => exportRows("csv")} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-flame px-4 text-sm font-medium text-on-dark hover:bg-flame/90 disabled:opacity-50">
              <Download aria-hidden className="h-4 w-4" /> CSV ({rows.length.toLocaleString("en-US")})
            </button>
            <button type="button" disabled={!rows.length} onClick={() => exportRows("json")} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-panel-2 disabled:opacity-50">
              <FileJson aria-hidden className="h-4 w-4" /> JSON
            </button>
          </div>
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Test rows (scrollable)">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b-2 border-rule text-left text-xs font-semibold text-ink">
                {["Investigation", "Material / fuel", "Sample size", "O₂ %", "Pressure psi", "Airflow cm/s", "Results recorded"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const i = byId.get(r.psi_id)!;
                return (
                  <tr key={`${r.table}-${r.row}`} className="border-b border-line/70 align-top hover:bg-panel-2/50">
                    <td className="px-3 py-2">
                      <Link href={`/investigations/${r.psi_id}`} className="font-medium hover:text-flame">{i.name}</Link>
                      <span className="block font-mono text-[11px] text-faint">{r.psi_id} · row {r.row}</span>
                    </td>
                    <td className="max-w-48 px-3 py-2 text-xs">{r.material ?? <span className="text-faint">–</span>}</td>
                    <td className="max-w-56 px-3 py-2 text-xs text-muted">{r.size ?? <span className="text-faint">–</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{cellRange(r.o2, "") || <span className="text-faint">–</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{cellRange(r.pressure, "") || <span className="text-faint">–</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{cellRange(r.airflow, "") || <span className="text-faint">–</span>}</td>
                    <td className="max-w-72 px-3 py-2 text-xs text-muted">{r.outcomes ?? <span className="text-faint">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && !rows.length ? <p className="py-8 text-center text-muted">No test rows match these filters.</p> : null}
        </div>
        {rows.length > PAGE ? (
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
              Rows {page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length.toLocaleString("en-US")}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-panel-2 disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-panel-2 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
