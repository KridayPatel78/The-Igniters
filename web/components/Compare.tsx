"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { MAX_COMPARE, useCompare } from "@/lib/compareStore";
import { displayName, fmtRange, GRAVITY_LABEL, NOT_REPORTED, PHASE_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { InvestigationLite, Scenario } from "@/lib/types";
import { O2Chart } from "./O2Chart";

type Row = { label: string; render: (r: InvestigationLite) => string };

const ROWS: Row[] = [
  { label: "PSI ID", render: (r) => r.psi_id },
  { label: "Title", render: (r) => r.title },
  { label: "DOI", render: (r) => r.doi },
  { label: "Platform", render: (r) => r.platform },
  { label: "Hardware", render: (r) => r.hardware },
  { label: "Fuel phase", render: (r) => PHASE_LABEL[r.fuel_phase] },
  { label: "Fuels", render: (r) => r.fuels.join("; ") || NOT_REPORTED },
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

export function Compare({ records, scenarios, phaseUnknown }: { records: InvestigationLite[]; scenarios: Scenario[]; phaseUnknown: string[] }) {
  const params = useSearchParams();
  const router = useRouter();
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
    router.replace(next.length ? `/compare?ids=${next.join(",")}` : "/compare", { scroll: false });
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
            <span key={r.psi_id} className="inline-flex items-center gap-1 rounded-full border border-ion/40 bg-ion/10 py-1 pl-3 pr-1 text-sm">
              {displayName(r.acronym, r.psi_id)}
              <button
                type="button"
                onClick={() => update(ids.filter((x) => x !== r.psi_id))}
                className="rounded-full p-1 text-muted hover:bg-panel-2 hover:text-ink"
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
            <Search aria-hidden className="pointer-events-none absolute left-3 top-[2.15rem] h-4 w-4 text-faint" />
            <input
              id="compare-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or PSI ID, e.g. FLEX or PSI-98"
              className="w-full rounded-lg border border-line bg-panel py-2 pl-9 pr-3 text-ink placeholder:text-faint"
              autoComplete="off"
            />
            {matches.length ? (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-panel-2 shadow-lg" role="listbox" aria-label="Matching investigations">
                {matches.map((r) => (
                  <li key={r.psi_id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        update([...ids, r.psi_id]);
                        setQuery("");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-panel"
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
        <div className="rounded-xl border border-line bg-panel p-6 text-muted">
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
          <section aria-labelledby="o2-chart" className="rounded-xl border border-line bg-panel p-5">
            <h2 id="o2-chart" className="mb-3 text-lg font-semibold">Oxygen tested vs. habitat targets</h2>
            <O2Chart items={selected} scenarios={scenarios} />
          </section>
          <section aria-labelledby="compare-table">
            <h2 id="compare-table" className="sr-only">Side-by-side fields</h2>
            <div className="overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Comparison table (scrollable)">
              <table className="w-full min-w-[640px] table-fixed text-sm">
                <thead className="bg-panel-2 text-left">
                  <tr>
                    <th scope="col" className="w-36 px-4 py-3 font-medium text-muted">Field</th>
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
                  {ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-line align-top">
                      <th scope="row" className="px-4 py-2 text-left font-medium text-muted">{row.label}</th>
                      {selected.map((r) => {
                        const text = row.label === "Fuel phase" && phaseUnknown.includes(r.psi_id) ? "Unknown (not established by PSI text)" : row.render(r);
                        return (
                          <td key={r.psi_id} className={`break-words px-4 py-2 ${row.label === "Source" ? "break-all" : ""} ${text === NOT_REPORTED ? "text-faint" : ""}`}>
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
