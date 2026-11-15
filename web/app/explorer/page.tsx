import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Check, Download, Minus } from "lucide-react";
import { DataExplorer, type ExplorerInvestigation } from "@/components/explorer/DataExplorer";
import { Card } from "@/components/dashboard/parts";
import { getCardFacts, getInvestigations, getScenarios } from "@/lib/data";
import { displayName, NOT_REPORTED } from "@/lib/format";
import type { Investigation } from "@/lib/types";

export const metadata: Metadata = {
  title: "Data Explorer",
  description: "Every test row in NASA's PSI combustion tables with oxygen, pressure and airflow in common units. Filter, plot and download with citations.",
};

const text = (v: string) => Boolean(v) && v !== NOT_REPORTED;
const FIELDS: { label: string; has: (r: Investigation) => boolean }[] = [
  { label: "Objective", has: (r) => text(r.objective_summary) },
  { label: "Fuels / samples", has: (r) => r.fuels.length > 0 },
  { label: "O₂", has: (r) => r.o2_percent_range !== null },
  { label: "Pressure", has: (r) => r.pressure_psi_range !== null },
  { label: "Airflow", has: (r) => r.airflow_cm_s_range !== null },
  { label: "Sensors", has: (r) => r.measurements.length > 0 },
  { label: "Test table", has: (r) => r.tests.length > 0 },
  { label: "Key findings", has: (r) => text(r.key_findings) },
  { label: "Earth use", has: (r) => text(r.earth_applications) },
];

export default function ExplorerPage() {
  const records = getInvestigations();
  const facts = getCardFacts();
  const investigations: ExplorerInvestigation[] = records.map((r) => ({
    psi_id: r.psi_id,
    name: displayName(r.acronym, r.psi_id),
    doi: r.doi,
    phase: facts[r.psi_id].phase_unknown ? "unknown" : r.fuel_phase === "mixed" ? "unknown" : r.fuel_phase,
    pillars: r.pillars,
  }));
  const fieldTotals = FIELDS.map((f) => records.filter(f.has).length);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="text-sm text-muted">For modelers · predictive flammability</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Data Explorer</h1>
        <p className="mt-1 text-muted">
          Every row of NASA&apos;s experimental tables in one place, with oxygen, pressure and airflow converted to the same
          units. Filter it, see which conditions were tested, and download it with citations. Nothing is estimated: a blank
          means NASA&apos;s table doesn&apos;t report it.
        </p>
      </header>

      <Suspense fallback={<p role="status" className="border border-rule bg-panel p-6 text-muted">Loading the Data Explorer…</p>}>
        <DataExplorer investigations={investigations} scenarios={getScenarios().scenarios} />
      </Suspense>

      <Card
        id="completeness"
        title="What NASA reports for each investigation"
        sub="Filled = present in NASA's PSI record or tables. Gaps are shown, not filled in."
      >
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Data completeness (scrollable)">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b-2 border-rule text-left text-xs font-semibold text-ink">
                <th scope="col" className="px-3 py-2 font-medium">Investigation</th>
                {FIELDS.map((f, i) => (
                  <th key={f.label} scope="col" className="px-2 py-2 text-center font-medium">
                    {f.label}
                    <span className="block font-mono text-[10px] normal-case text-faint">{fieldTotals[i]}/{records.length}</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Download</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.psi_id} className="border-b border-line/60 hover:bg-panel-2/50">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <Link href={`/investigations/${r.psi_id}`} className="font-medium hover:text-flame">{displayName(r.acronym, r.psi_id)}</Link>
                    <span className="ml-2 font-mono text-[11px] text-faint">{r.psi_id}</span>
                  </th>
                  {FIELDS.map((f) => {
                    const ok = f.has(r);
                    return (
                      <td key={f.label} className="px-2 py-1.5 text-center">
                        {ok ? (
                          <span className="inline-grid h-6 w-6 place-items-center rounded-lg bg-good/15 text-good">
                            <Check aria-hidden className="h-3.5 w-3.5" />
                            <span className="sr-only">reported</span>
                          </span>
                        ) : (
                          <span className="inline-grid h-6 w-6 place-items-center rounded-lg border border-line text-faint">
                            <Minus aria-hidden className="h-3.5 w-3.5" />
                            <span className="sr-only">not reported</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right">
                    {r.tests.length ? (
                      <a href={`/data/tables/${r.psi_id}.csv`} download className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-ion hover:underline">
                        <Download aria-hidden className="h-3.5 w-3.5" /> NASA table
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-faint">
          &ldquo;NASA table&rdquo; downloads the test rows with every original column exactly as in the PSI CSV, plus the PSI ID and DOI.
          Footnotes, flow-visualization references, note-only rows and exact duplicates are set aside; each investigation&apos;s page lists
          them under Data cleaning. Data is CC0; cite each investigation by its DOI.
        </p>
      </Card>
    </div>
  );
}
