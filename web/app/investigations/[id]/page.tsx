import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink as ExternalIcon } from "lucide-react";
import { CompareToggle } from "@/components/CompareToggle";
import { ScoreBar } from "@/components/ScoreBar";
import { ProvenanceText } from "@/components/Provenance";
import { ExternalLink, Panel, PhaseChip, PillarChips, SectionTitle, UncheckedBadge } from "@/components/ui";
import { getCardFacts, getExplorer, getInvestigation, getInvestigations, getProvenance, getRanking, getScenarios, isPlaceholder, rankingKey } from "@/lib/data";
import { isBookkeeping, sampleSizes, summarizeTable } from "@/lib/variables";
import { EvidenceChart } from "@/components/evidence/EvidenceChart";
import { buildEvidence, type Family } from "@/lib/evidence";
import { displayName, doiUrl, FAMILY_OF, familyBackground, SYMBOL, fmtRange, GRAVITY_LABEL, NOT_REPORTED, PHASE_LABEL, psiUrl } from "@/lib/format";
import type { Investigation } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return getInvestigations().map((r) => ({ id: r.psi_id }));
}

export async function generateMetadata({ params }: PageProps<"/investigations/[id]">): Promise<Metadata> {
  const r = getInvestigation((await params).id);
  return r ? { title: `${displayName(r.acronym, r.psi_id)} (${r.psi_id})`, description: r.objective_summary } : {};
}

const FIELD_ORDER: (keyof Investigation)[] = [
  "psi_id", "acronym", "title", "doi", "platform", "hardware", "fuel_phase", "fuels", "o2_percent_range",
  "pressure_psi_range", "airflow_cm_s_range", "gravity", "pillars", "measurements", "objective_summary",
  "key_findings", "earth_applications", "tests", "source_urls", "extraction_confidence",
];

function Text({ value }: { value: string }) {
  return value === NOT_REPORTED ? <span className="text-faint">Not reported in PSI text</span> : <>{value}</>;
}

function valuePreview(r: Investigation, field: keyof Investigation): string {
  const v = r[field];
  if (field === "tests") return `${r.tests.length} rows`;
  if (v === null) return "null (not reported)";
  if (Array.isArray(v)) return v.length ? (v as unknown[]).map(String).join("; ") : "[] (none)";
  return String(v);
}

export default async function InvestigationPage({ params }: PageProps<"/investigations/[id]">) {
  const { id } = await params;
  const r = getInvestigation(id);
  if (!r) notFound();
  const provenance = getProvenance()[r.psi_id] ?? {};
  const phaseUnknown = isPlaceholder(provenance.fuel_phase);
  const scenarios = getScenarios().scenarios;
  const scores = scenarios.map((s) => {
    const results = getRanking(rankingKey(s.key, "all", s.ventilation)).results;
    const pos = results.findIndex((x) => x.psi_id === r.psi_id);
    return { scenario: s, result: results[pos], rank: pos + 1 };
  });
  const tables = groupTests(r.tests);
  const variables = tables.map((t) => summarizeTable(t.name, t.rows));
  const sizes = sampleSizes(r.tests);
  const family = FAMILY_OF[r.psi_id];
  const cardFacts = getCardFacts();
  const own = cardFacts[r.psi_id];
  const famOf = (): Family => (own.phase_unknown || own.fuel_phase === "mixed" ? "unknown" : own.fuel_phase);
  const evidence = buildEvidence(getExplorer().rows.filter((x) => x.psi_id === r.psi_id), famOf);
  const chartNames = { [r.psi_id]: { name: displayName(r.acronym, r.psi_id), symbol: "" } };

  const facts: [string, ReactNode][] = [
    ["Oxygen tested", fmtRange(r.o2_percent_range, "% O₂")],
    ["Pressure tested", fmtRange(r.pressure_psi_range, "psi")],
    ["Airflow tested", fmtRange(r.airflow_cm_s_range, "cm/s")],
    ["Fuel phase", phaseUnknown ? "Unknown (not established by PSI text)" : PHASE_LABEL[r.fuel_phase]],
    ["Gravity", GRAVITY_LABEL[r.gravity]],
    ["Platform", <Text key="p" value={r.platform} />],
    ["Hardware", <Text key="h" value={r.hardware} />],
    [
      "Hardware family",
      family ? (
        <span key="f">
          {family.label}
          <span className="mt-0.5 block text-xs font-normal text-muted">{family.hardware}</span>
        </span>
      ) : (
        NOT_REPORTED
      ),
    ],
    [
      "Sample / burner size",
      sizes.length ? (
        <ul key="s" className="space-y-0.5 text-sm font-normal">
          {sizes.map((z) => (
            <li key={z.column}>
              <span className="text-muted">{z.column}:</span> {z.values.join(", ")}
              {z.more ? <span className="text-faint"> +{z.more} more</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        NOT_REPORTED
      ),
    ],
  ];

  return (
    <article className="space-y-10">
      <header className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="flex items-start gap-5">
          <span
            aria-hidden
            className="relative flex h-28 w-28 shrink-0 flex-col justify-between border-2 border-rule p-2 text-ink"
            style={{ background: familyBackground([phaseUnknown || r.fuel_phase === "mixed" ? "unknown" : r.fuel_phase]) }}
          >
            <span className="flex justify-between text-xs font-semibold leading-none">
              <span className="tabular">{r.psi_id.replace("PSI-", "")}</span>
              <span>{r.pillars.map((p) => p[0].toUpperCase()).join(" ") || "–"}</span>
            </span>
            <span className="font-cond text-center text-5xl font-bold leading-none">{SYMBOL[r.psi_id] ?? "?"}</span>
            <span className="truncate text-xs font-medium leading-none">{family?.label ?? ""}</span>
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted">{r.psi_id}</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{displayName(r.acronym, r.psi_id)}</h1>
            <p className="mt-1 text-lg text-muted">{r.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PillarChips pillars={r.pillars} />
          <PhaseChip phase={r.fuel_phase} unknown={phaseUnknown} />
          {r.extraction_confidence === "llm_unchecked" ? <UncheckedBadge /> : null}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <ExternalLink href={doiUrl(r.doi)}>DOI {r.doi}</ExternalLink>
          <a href={psiUrl(r.psi_id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ion underline decoration-ion/40 underline-offset-4">
            View on NASA PSI <ExternalIcon aria-hidden className="h-3.5 w-3.5" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <CompareToggle id={r.psi_id} />
        </div>
      </header>

      {evidence.totals.placed + evidence.totals.o2Only > 0 ? (
        <section aria-labelledby="chart">
          <SectionTitle id="chart" sub="This investigation's own test rows on the chart of the evidence; the red frame is the Moon base / rover region. Switch habitats on the dashboard.">
            Where its tests sit
          </SectionTitle>
          <EvidenceChart evidence={evidence} scenarioKey="moon_base" names={chartNames} subject={displayName(r.acronym, r.psi_id)} />
        </section>
      ) : (
        <section aria-labelledby="chart">
          <SectionTitle id="chart">Where its tests sit</SectionTitle>
          <p className="cell-empty border border-rule p-4 text-sm text-body">
            NASA&apos;s table for this investigation reports no oxygen value, so none of its {r.tests.length} test rows can be placed on the
            chart of the evidence. This is itself a gap: the oxygen level of these tests is not in PSI.
          </p>
        </section>
      )}

      <section aria-labelledby="facts">
        <SectionTitle id="facts">Key facts</SectionTitle>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="border border-rule bg-panel p-4">
              <dt className="text-xs font-semibold text-muted">{label}</dt>
              <dd className={`mt-1 ${value === NOT_REPORTED ? "text-faint" : "font-medium"}`}>{value === NOT_REPORTED ? "Not reported" : value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="summary" className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <SectionTitle id="summary">Objective</SectionTitle>
            <p className="leading-relaxed"><Text value={r.objective_summary} /></p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Key findings</h3>
            <p className="leading-relaxed"><Text value={r.key_findings} /></p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Earth applications</h3>
            <p className="leading-relaxed"><Text value={r.earth_applications} /></p>
          </div>
        </div>
        <div className="space-y-6">
          <List title="Fuels and samples" items={r.fuels} />
          <List title="Sensors and measurements" items={r.measurements} />
        </div>
      </section>

      {variables.length ? (
        <section aria-labelledby="variables">
          <SectionTitle id="variables" sub="What changed from one test to the next, and what stayed fixed, read straight from NASA's test table. Dates, times and test numbers are left out.">
            How the tests differed
          </SectionTitle>
          <div className="space-y-4">
            {variables.map((v) => {
              const varied = v.varied.filter((c) => !isBookkeeping(c.column));
              const constant = v.constant.filter((c) => !isBookkeeping(c.column));
              return (
                <Panel key={v.table} className="p-5">
                  {variables.length > 1 ? <h3 className="mb-3 font-mono text-xs text-muted">{v.table} · {v.rows} rows</h3> : null}
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm text-muted">Varied between tests ({varied.length})</p>
                      {varied.length ? (
                        <ul className="space-y-1.5 text-sm">
                          {varied.map((c) => (
                            <li key={c.column}>
                              <span className="font-medium text-ink">{c.column.trim()}</span>{" "}
                              <span className="text-muted">
                                · {c.distinct.length} values, e.g. {c.distinct.slice(0, 3).join("; ")}
                                {c.blank ? ` (${c.blank} blank)` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-faint">Nothing varied apart from dates and test numbers.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-ink">Same in every test ({constant.length})</p>
                      {constant.length ? (
                        <ul className="space-y-1.5 text-sm">
                          {constant.map((c) => (
                            <li key={c.column}>
                              <span className="font-medium text-ink">{c.column.trim()}</span> <span className="text-muted">· {c.distinct[0]}</span>
                              {c.blank ? <span className="text-faint"> ({c.blank} blank)</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-faint">No column held the same value in every test.</p>
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="scores">
        <SectionTitle id="scores" sub="Focus: all pillars, each scenario's default ventilation. Full reasons are in the dashboard table.">
          Score in each scenario
        </SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-left text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Scenario</th>
                <th scope="col" className="px-4 py-2 font-medium">Rank</th>
                <th scope="col" className="px-4 py-2 font-medium">Score</th>
                <th scope="col" className="px-4 py-2 font-medium">A · B · C · D · E</th>
              </tr>
            </thead>
            <tbody>
              {scores.map(({ scenario, result, rank }) => (
                <tr key={scenario.key} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    <Link href={`/?scenario=${scenario.key}&focus=all`} className="hover:text-flame">{scenario.label}</Link>
                  </th>
                  <td className="tabular px-4 py-2">#{rank} of 24</td>
                  <td className="tabular px-4 py-2 font-semibold">{result.total}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-40"><ScoreBar breakdown={result.breakdown} /></div>
                      <span className="tabular text-xs text-muted">{result.breakdown.map((b) => b.points).join(" · ")}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="tests">
        <SectionTitle
          id="tests"
          sub={
            <>
              Every row exactly as in NASA&apos;s experimental-table CSV.{" "}
              {r.tests.length ? (
                <a href={`/data/tables/${r.psi_id}.csv`} download className="text-ion underline decoration-ion/40 underline-offset-4">
                  Download as CSV
                </a>
              ) : null}
              {r.tests.length ? (
                <>
                  {" · "}
                  <Link href="/explorer" className="text-ion underline decoration-ion/40 underline-offset-4">Compare with all tests in the Data Explorer</Link>
                </>
              ) : null}
            </>
          }
        >
          Test table ({r.tests.length} rows)
        </SectionTitle>
        {tables.length === 0 ? (
          <Panel className="p-4 text-muted">No experimental table in PSI for this investigation.</Panel>
        ) : (
          <div className="space-y-6">
            {tables.map((t) => (
              <TestTable key={t.name} name={t.name} rows={t.rows} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="provenance">
        <details className="border border-rule bg-panel">
          <summary className="px-4 py-3 font-semibold">
            <span id="provenance">Where this came from</span>
            <span className="ml-2 text-sm font-normal text-muted">(source of every field)</span>
          </summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-left text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Field</th>
                  <th scope="col" className="px-4 py-2 font-medium">Value</th>
                  <th scope="col" className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_ORDER.map((field) => (
                  <tr key={field} className="border-t border-line align-top">
                    <th scope="row" className="px-4 py-2 text-left font-mono text-xs font-normal text-muted">{field}</th>
                    <td className="max-w-md px-4 py-2 text-xs">{valuePreview(r, field)}</td>
                    <td className="max-w-md px-4 py-2"><ProvenanceText value={provenance[field]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </article>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-faint">Not reported in PSI text</p>
      )}
    </div>
  );
}

function groupTests(tests: Record<string, string>[]) {
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of tests) {
    const name = row._table ?? "Experimental table";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(row);
  }
  return [...groups].map(([name, rows]) => ({ name, rows }));
}

function TestTable({ name, rows }: { name: string; rows: Record<string, string>[] }) {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => c !== "_table");
  return (
    <div>
      <h3 className="mb-2 font-mono text-sm text-muted">{name}</h3>
      <div className="max-h-[32rem] overflow-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label={`${name} (scrollable)`}>
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-panel-2 text-left">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-muted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line odd:bg-panel/60">
                {columns.map((c) => (
                  <td key={c} title={row[c]} className="tabular max-w-[22rem] truncate whitespace-nowrap px-3 py-1.5">{row[c]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
