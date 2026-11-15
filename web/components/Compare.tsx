"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { MAX_COMPARE, useCompare } from "@/lib/compareStore";
import { displayName, FAMILY_OF, fmtRange, GRAVITY_LABEL, NOT_REPORTED, PHASE_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { BreakdownItem, InvestigationLite, Scenario } from "@/lib/types";
import { RangeChart } from "./charts/RangeChart";
import { ScoreRadar } from "./charts/ScoreRadar";

type Row = { label: string; render: (r: InvestigationLite) => string; comparable?: boolean };

const SERIES = ["#111111", "#2a78d6", "#eb6834", "#1baf7a"];
const COMPARABLE = new Set(["Platform", "Hardware", "Hardware family", "Sample / burner size", "Fuel phase", "Fuels", "Oxygen", "Pressure", "Airflow", "Gravity", "Pillars", "Measurements"]);

const ROWS: Row[] = [
  { label: "PSI ID", render: (r) => r.psi_id },
  { label: "Title", render: (r) => r.title },
  { label: "DOI", render: (r) => r.doi },
  { label: "Platform", render: (r) => r.platform },
  { label: "Hardware", render: (r) => r.hardware },
  { label: "Hardware family", render: (r) => FAMILY_OF[r.psi_id]?.label ?? NOT_REPORTED },
  { label: "Fuel phase", render: (r) => PHASE_LABEL[r.fuel_phase] },
  { label: "Fuels", render: (r) => r.fuels.join("; ") || NOT_REPORTED },
  { label: "Sample / burner size", render: () => NOT_REPORTED },
  { label: "Oxygen", render: (r) => fmtRange(r.o2_percent_range, "% O₂") },
  { label: "Pressure", render: (r) => fmtRange(r.pressure_psi_range, "psi") },
  { label: "Airflow", render: (r) => fmtRange(r.airflow_cm_s_range, "cm/s") },
  { label: "Gravity", render: (r) => GRAVITY_LABEL[r.gravity] },
  { label: "Pillars", render: (r) => r.pillars.map((p) => PILLAR_LABEL[p]).join(", ") || "none" },
  { label: "Measurements", render: (r) => r.measurements.join("; ") || NOT_REPORTED },
  { label: "Objective", render: (r) => r.objective_summary },
  { label: "Key findings", render: (r) => r.key_findings },
  { label: "Earth applications", render: (r) => r.earth_applications },
  { label: "Test rows", render: (r) => (r.test_count ? `${r.test_count}` : "no experimental table") },
  { label: "Source", render: (r) => r.source_urls.join(" ") },
  { label: "Extraction", render: (r) => (r.extraction_confidence === "checked" ? "hand-checked" : "AI-extracted, not hand-checked") },
];

export function Compare({
  records,
  scenarios,
  phaseUnknown,
  breakdowns,
  sizes,
}: {
  records: InvestigationLite[];
  scenarios: Scenario[];
  phaseUnknown: string[];
  /** scenario key -> psi_id -> rubric breakdown (each scenario's default ventilation, all pillars) */
  breakdowns: Record<string, Record<string, { total: number; breakdown: BreakdownItem[] }>>;
  /** psi_id -> sample / burner geometry from the NASA test table (see lib/variables.ts) */
  sizes: Record<string, string>;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const scenarioKey = scenarios.some((s) => s.key === params.get("scenario")) ? params.get("scenario")! : "moon_base";
  function setScenarioKey(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "moon_base") next.delete("scenario");
    else next.set("scenario", key);
    router.replace(`/compare?${next.toString()}`, { scroll: false });
  }
  const { set } = useCompare();
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(records.map((r) => [r.psi_id, r])), [records]);
  const fromUrl = (params.get("ids") ?? "").split(",").map((s) => s.trim()).filter((id) => byId.has(id));
  const ids = [...new Set(fromUrl)].slice(0, MAX_COMPARE);
  const selected = ids.map((id) => byId.get(id)!);

  // Keep "Add to compare" selections in sync with what's being compared.
  const idsKey = ids.join(",");
  useEffect(() => {
    if (idsKey) set(idsKey.split(","));
  }, [idsKey, set]);

  function update(next: string[]) {
    const sc = scenarioKey === "moon_base" ? "" : `&scenario=${scenarioKey}`;
    router.replace(next.length ? `/compare?ids=${next.join(",")}${sc}` : "/compare", { scroll: false });
  }

  const q = query.trim().toLowerCase();
  const matches = q
    ? records.filter((r) => !ids.includes(r.psi_id) && `${r.psi_id} ${r.acronym} ${r.title}`.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {selected.map((r) => (
            <span key={r.psi_id} className="inline-flex items-center gap-1 border border-rule bg-panel-2 py-1 pl-3 pr-1 text-sm">
              {displayName(r.acronym, r.psi_id)}
              <button
                type="button"
                onClick={() => update(ids.filter((x) => x !== r.psi_id))}
                className="grid h-7 w-7 place-items-center text-muted hover:bg-panel-3 hover:text-ink"
                aria-label={`Remove ${displayName(r.acronym, r.psi_id)}`}
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        {ids.length < MAX_COMPARE ? (
          <div className="relative max-w-md">
            <label htmlFor="compare-search" className="mb-1 block text-sm text-muted">
              Add an investigation ({ids.length} of {MAX_COMPARE})
            </label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-[2.1rem] h-4 w-4 text-faint" />
            <input
              id="compare-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or PSI ID, e.g. FLEX or PSI-98…"
              className="h-10 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-base text-ink placeholder:text-faint sm:text-sm"
              spellCheck={false}
              autoComplete="off"
            />
            {matches.length ? (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-pop" role="listbox" aria-label="Matching investigations">
                {matches.map((r) => (
                  <li key={r.psi_id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        update([...ids, r.psi_id]);
                        setQuery("");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2"
                    >
                      <span className="font-medium">{displayName(r.acronym, r.psi_id)}</span>{" "}
                      <span className="font-mono text-xs text-faint">{r.psi_id}</span>
                      <span className="block truncate text-muted">{r.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {selected.length < 2 ? (
        <div className="border border-rule bg-panel p-6 text-muted">
          <p>Choose at least two investigations to compare.</p>
          <p className="mt-2">
            Try{" "}
            <Link className="text-ion underline underline-offset-4" href="/compare?ids=PSI-98,PSI-26">SAFFIRE-I vs BASS</Link>,{" "}
            <Link className="text-ion underline underline-offset-4" href="/compare?ids=PSI-69,PSI-68">FLEX vs FLEX-2</Link> or{" "}
            <Link className="text-ion underline underline-offset-4" href="/compare?ids=PSI-102,PSI-101,PSI-47">SAME vs SAME-R vs DAFT</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <section aria-labelledby="radar-title" className="border border-rule bg-panel p-5">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="radar-title" className="text-base font-semibold">Score profile</h2>
                  <p className="text-sm text-muted">Each criterion as a share of its maximum points.</p>
                </div>
                <label className="text-xs text-faint">
                  <span className="sr-only">Scenario</span>
                  <select value={scenarioKey} onChange={(e) => setScenarioKey(e.target.value)} className="h-10 rounded-lg border border-line bg-panel px-2 text-base text-ink sm:text-sm">
                    {scenarios.map((s) => (
                      <option key={s.key} value={s.key}>{s.label.split(" (")[0]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <ScoreRadar
                items={selected.map((r) => ({ id: r.psi_id, name: displayName(r.acronym, r.psi_id), breakdown: breakdowns[scenarioKey]?.[r.psi_id]?.breakdown ?? [] }))}
              />
              <p className="mt-1 text-center text-sm text-muted">
                Totals:{" "}
                {selected.map((r, i) => (
                  <span key={r.psi_id} className="mr-3 whitespace-nowrap">
                    <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: SERIES[i] }} />
                    {displayName(r.acronym, r.psi_id)} <span className="font-mono text-ink">{breakdowns[scenarioKey]?.[r.psi_id]?.total ?? "–"}</span>
                  </span>
                ))}
              </p>
            </section>
            <section aria-labelledby="ranges-title" className="space-y-4 border border-rule bg-panel p-5">
              <div>
                <h2 id="ranges-title" className="text-base font-semibold">Test conditions side by side</h2>
                <p className="text-sm text-muted">Ranges from NASA&apos;s test tables. Overlap means the experiments can be compared directly.</p>
              </div>
              {(
                [
                  ["Oxygen (%)", "o2_percent_range", "% O₂", [0, 100], scenarios.map((s) => s.o2_percent)],
                  ["Pressure (psi)", "pressure_psi_range", "psi", [0, 80], scenarios.map((s) => s.pressure_psi)],
                  ["Airflow (cm/s)", "airflow_cm_s_range", "cm/s", [0, 90], []],
                ] as const
              ).map(([title, key, unit, domain, marks]) => (
                <div key={key}>
                  <h3 className="mb-1 text-xs font-semibold text-muted">{title}</h3>
                  <RangeChart
                    unit={unit}
                    domain={[domain[0], domain[1]]}
                    items={selected.map((r, i) => ({ id: r.psi_id, name: displayName(r.acronym, r.psi_id), range: r[key], color: SERIES[i] }))}
                    targets={[...new Set(marks)].map((v) => ({
                      value: v,
                      label: `${scenarios.filter((s) => (key === "o2_percent_range" ? s.o2_percent : s.pressure_psi) === v).map((s) => s.label.split(" (")[0].split(" /")[0]).join(" / ")}`,
                    }))}
                  />
                </div>
              ))}
            </section>
          </div>
          <section aria-labelledby="compare-table">
            <h2 id="compare-table" className="sr-only">Side-by-side fields</h2>
            <div className="overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Comparison table (scrollable)">
              <table className="w-full min-w-[640px] table-fixed text-sm">
                <thead className="bg-panel-2 text-left">
                  <tr>
                    <th scope="col" className="w-40 px-4 py-3 font-medium text-muted">Field</th>
                    {selected.map((r) => (
                      <th key={r.psi_id} scope="col" className="px-4 py-3">
                        <Link href={`/investigations/${r.psi_id}`} className="font-semibold hover:text-flame">
                          {displayName(r.acronym, r.psi_id)}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => {
                    const values = selected.map((r) =>
                      row.label === "Fuel phase" && phaseUnknown.includes(r.psi_id)
                        ? "unknown"
                        : row.label === "Sample / burner size"
                          ? (sizes[r.psi_id] ?? NOT_REPORTED)
                          : row.render(r),
                    );
                    const same = COMPARABLE.has(row.label) ? values.every((v) => v === values[0]) : null;
                    return (
                    <tr key={row.label} className="border-t border-line align-top">
                      <th scope="row" className="px-4 py-2 text-left font-medium text-muted">
                        {row.label}
                        {same === null ? null : (
                          <span className={`ml-2 inline-block border border-line px-1 text-[11px] font-medium ${same ? "text-good" : "cell-empty text-ink"}`}>
                            {same ? "same" : "differs"}
                          </span>
                        )}
                      </th>
                      {selected.map((r, i) => {
                        const text = values[i] === "unknown" && row.label === "Fuel phase" ? "Unknown (not established by PSI text)" : values[i];
                        return (
                          <td key={r.psi_id} className={`break-words px-4 py-2 ${row.label === "Source" ? "break-all" : ""} ${text === NOT_REPORTED ? "text-faint" : ""}`}>
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
