/*
 * DIRECTION CONTRACT (impeccable new-work; DESIGN.md "Chart of the Evidence")
 * THESIS: the dashboard is a chart of where NASA's fire evidence exists and where it runs out; it refuses the
 *   KPI-cards-plus-charts admin template and the editorial essay.
 * OWN-WORLD: nuclide-chart paper: white ground, black cell rules, flat fuel-coded fills (red solid, blue droplet,
 *   yellow gas, grey unknown), hatched untested cells, a red habitat frame, condensed symbols in element tiles.
 * STORY: a researcher picks their habitat, sees which oxygen-pressure cells were tested and by what fuel, reads the
 *   gap in one sentence, then opens the ranked experiments and their data.
 * FIRST VIEWPORT: title + habitat cells on top; the evidence chart owns the width with the reading panel on its right;
 *   the habitat frame is the focal point.
 * FORM: candidate 7 of 7 (Chart of the Nuclides), roll a3b11acc; own staging (chart first, element table second);
 *   dealt stagings declined: none clarifies a ranking-and-gaps task.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CardFacts } from "@/lib/data";
import type { Evidence } from "@/lib/evidence";
import { SCENARIO_NOTE, SYMBOL } from "@/lib/format";
import type { Focus, RankedResult, Scenario, Ventilation } from "@/lib/types";
import { CompareTray } from "./CompareToggle";
import { AskChips } from "./dashboard/parts";
import { RankingTable } from "./dashboard/RankingTable";
import { ElementTable, TileKey } from "./evidence/ElementTable";
import { EvidenceChart } from "./evidence/EvidenceChart";
import { CriteriaLegend } from "./ScoreBar";

export interface ExploreState {
  scenario: string;
  focus: Focus;
  vent: Ventilation;
}

const FOCUS_LABEL: Record<Focus, string> = {
  all: "All pillars",
  prevention: "Prevention",
  detection: "Detection",
  suppression: "Suppression",
};

export function exploreHref(s: ExploreState, defaults: Record<string, Ventilation>): string {
  const params = new URLSearchParams({ scenario: s.scenario, focus: s.focus });
  if (s.vent !== defaults[s.scenario]) params.set("vent", s.vent);
  return `/?${params.toString()}`;
}

export const shortLabel = (s: Scenario) => s.label.split(" (")[0];

interface Props {
  scenarios: Scenario[];
  focuses: Focus[];
  partialGravity: string[];
  state: ExploreState;
  results: RankedResult[] | null;
  explanation: string | undefined;
  facts: CardFacts;
  testRows: number;
  evidence: Evidence;
}

/** Choice row made of links, so every choice is in the URL (shareable, Back/Forward work). */
function Choice<T extends string>({ label, options, current, href }: { label: string; options: { value: T; label: ReactNode }[]; current: T; href: (v: T) => string }) {
  return (
    <div role="group" aria-label={label} className="min-w-0">
      <p className="mb-1.5 text-xs font-semibold text-muted">{label}</p>
      <div className="flex flex-wrap">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <Link
              key={o.value}
              href={href(o.value)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={`-ml-px min-h-11 border border-rule px-3 py-1.5 text-sm transition-colors first:ml-0 sm:min-h-10 ${
                active ? "relative z-10 bg-rule font-semibold text-white" : "bg-bg text-ink hover:bg-panel-2"
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SectionHead({ id, title, sub, action }: { id: string; title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-rule pb-2">
      <div>
        <h2 id={id} className="font-cond scroll-mt-24 text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {sub ? <p className="mt-0.5 max-w-prose text-sm text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ExploreView({ scenarios, focuses, state, results, explanation, facts, testRows, evidence }: Props) {
  const defaults = Object.fromEntries(scenarios.map((s) => [s.key, s.ventilation]));
  const current = scenarios.find((s) => s.key === state.scenario) ?? scenarios[0];
  const n = Object.keys(facts).length;
  const names = Object.fromEntries(Object.entries(facts).map(([id, f]) => [id, { name: f.name, symbol: SYMBOL[id] ?? "" }]));
  const top = results?.[0];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Where NASA&apos;s fire evidence runs out</h1>
        <p className="tabular max-w-xl text-sm leading-relaxed text-muted">
          {n} NASA PSI combustion investigations · {testRows.toLocaleString("en-US")} test rows, each placed where it was burned. Hatched = never tested.
        </p>
      </header>

      <section aria-label="Choose a habitat" className="-mt-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Choice
            label="Habitat"
            current={state.scenario}
            href={(v) => exploreHref({ scenario: v, focus: state.focus, vent: defaults[v] }, defaults)}
            options={scenarios.map((s) => ({
              value: s.key,
              label: (
                <span className="flex flex-col text-left leading-tight">
                  <span>{shortLabel(s).replace(" / pressurized rover", " / rover")}</span>
                  <span className="tabular text-xs opacity-80">
                    {s.o2_percent}%&nbsp;O₂ · {s.pressure_psi}&nbsp;psi
                  </span>
                </span>
              ),
            }))}
          />
          <Choice label="Safety focus" current={state.focus} href={(v) => exploreHref({ ...state, focus: v }, defaults)} options={focuses.map((f) => ({ value: f, label: FOCUS_LABEL[f] }))} />
          <Choice
            label="Cabin ventilation"
            current={state.vent}
            href={(v) => exploreHref({ ...state, vent: v }, defaults)}
            options={[
              { value: "ventilated" as Ventilation, label: "Working" },
              { value: "quiescent" as Ventilation, label: "Failed (still air)" },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="chart-title" className="-mt-4">
        <h2 id="chart-title" className="sr-only">
          Chart of the evidence: tested oxygen against pressure
        </h2>
        <EvidenceChart evidence={evidence} scenarioKey={state.scenario} names={names} note={SCENARIO_NOTE[current.key]} showGravity />
      </section>

      <section aria-labelledby="table-title">
        <SectionHead
          id="table-title"
          title="Table of investigations"
          sub={`All ${n}, grouped by the hardware they ran on; same row, directly comparable. Scored 0–100 for ${shortLabel(current).toLowerCase()}, ${FOCUS_LABEL[state.focus].toLowerCase()}.`}
          action={<TileKey />}
        />
        {results ? <ElementTable results={results} facts={facts} habitat={shortLabel(current)} /> : <p role="status" className="py-10 text-muted">Loading scores…</p>}
      </section>

      <section aria-labelledby="ranking-title">
        <SectionHead
          id="ranking-title"
          title={`Ranked for ${shortLabel(current).toLowerCase()}`}
          sub="Sort any column; open a row for every point's reason. Rules rank; the AI only explains."
          action={<CriteriaLegend />}
        />
        <div className="mb-6 grid gap-6 border border-rule bg-panel-2 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div>
            <p className="text-sm font-semibold text-ink">Why {top ? facts[top.psi_id].name : "these"} and the next ones rank highest</p>
            <p className="mt-1 max-w-prose text-[15px] leading-relaxed text-body">{explanation ?? "No explanation for this combination."}</p>
            <p className="mt-2 text-xs text-muted">Written by AI from the rubric&apos;s own reasons, checked against them. Citations: [PSI ID].</p>
          </div>
          <AskChips
            questions={[
              top ? `Why is ${facts[top.psi_id].name} relevant to fire safety in a ${shortLabel(current).toLowerCase()}?` : "How does fire spread on fabric in microgravity?",
              "Which experiments tested oxygen levels above 30%?",
              "Is there any fire data for Moon or Mars gravity?",
            ]}
          />
        </div>
        {results ? <RankingTable results={results} facts={facts} singlePillar={state.focus !== "all"} /> : <p role="status" className="py-10 text-muted">Loading ranking…</p>}
      </section>

      <nav aria-label="Go further" className="border-t-2 border-rule">
        <ul className="divide-y divide-line">
          {[
            ["/controls", "Fire-safety controls", "What prevention, detection and suppression research found, what equipment it shapes, what is still missing, and the Earth spin-offs (water mist, smoke detectors, air tanks, fire attire)."],
            ["/explorer", "Data Explorer", "All 1,943 cleaned test rows with oxygen, pressure and airflow in common units; filter, plot, download with DOIs."],
            ["/compare", "Compare investigations", "2 to 4 side by side: score profile, tested ranges, and every field marked same or different."],
            ["/context", "Why it matters", "Apollo 1, Apollo 13 and the 1997 Mir fire: the incidents that made spacecraft fire safety a design requirement."],
          ].map(([href, title, text]) => (
            <li key={href}>
              <Link href={href} className="group grid gap-1 py-4 sm:grid-cols-[16rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6">
                <span className="text-base font-semibold text-ink group-hover:underline">{title}</span>
                <span className="text-sm text-body">{text}</span>
                <ArrowRight aria-hidden className="hidden h-4 w-4 text-ink sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <CompareTray />
    </div>
  );
}
