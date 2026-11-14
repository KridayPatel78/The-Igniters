import Link from "next/link";
import { Orbit, Sparkles } from "lucide-react";
import type { CardFacts } from "@/lib/data";
import { displayName } from "@/lib/format";
import type { Focus, RankedResult, Scenario, Ventilation } from "@/lib/types";
import { CompareTray } from "./CompareToggle";
import { KnownGaps } from "./KnownGaps";
import { RankedCard } from "./RankedCard";
import { CriteriaLegend } from "./ScoreBar";
import { Panel } from "./ui";

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

interface Props {
  scenarios: Scenario[];
  focuses: Focus[];
  partialGravity: string[];
  state: ExploreState;
  results: RankedResult[] | null;
  explanation: string | undefined;
  facts: CardFacts;
}

export function ExploreView({ scenarios, focuses, partialGravity, state, results, explanation, facts }: Props) {
  const defaults = Object.fromEntries(scenarios.map((s) => [s.key, s.ventilation]));
  const current = scenarios.find((s) => s.key === state.scenario) ?? scenarios[0];
  const isPartial = partialGravity.includes(state.scenario);
  const pinned = results?.filter((r) => r.callouts.includes("closest_to_partial_gravity")) ?? [];
  const singlePillar = state.focus !== "all";
  const matching = results?.filter((r) => r.matches_focus) ?? [];
  const others = results?.filter((r) => !r.matches_focus) ?? [];

  return (
    <div className="space-y-8">
      <section aria-labelledby="controls-title" className="space-y-5">
        <h2 id="controls-title" className="sr-only">
          Choose a scenario
        </h2>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Where does the crew live?</p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scenarios.map((s) => {
              const active = s.key === state.scenario;
              return (
                <li key={s.key}>
                  <Link
                    href={exploreHref({ scenario: s.key, focus: state.focus, vent: s.ventilation }, defaults)}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={`block h-full rounded-xl border p-4 transition-colors ${
                      active ? "border-flame bg-flame/10" : "border-line bg-panel hover:border-flame/50"
                    }`}
                  >
                    <span className="block font-semibold">{s.label}</span>
                    <span className="mt-1 block font-mono text-sm text-muted">
                      {s.o2_percent}% O₂ · {s.pressure_psi} psi
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Safety focus</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Safety focus">
              {focuses.map((f) => (
                <Link
                  key={f}
                  href={exploreHref({ ...state, focus: f }, defaults)}
                  scroll={false}
                  aria-current={f === state.focus ? "true" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    f === state.focus ? "border-crit-pillars bg-crit-pillars/15 text-ink" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {FOCUS_LABEL[f]}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Cabin ventilation</p>
            <div className="inline-flex rounded-lg border border-line p-1" role="group" aria-label="Cabin ventilation">
              {(["ventilated", "quiescent"] as Ventilation[]).map((v) => (
                <Link
                  key={v}
                  href={exploreHref({ ...state, vent: v }, defaults)}
                  scroll={false}
                  aria-current={v === state.vent ? "true" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm ${v === state.vent ? "bg-ion text-bg font-semibold" : "text-muted hover:text-ink"}`}
                >
                  {v === "ventilated" ? "Working (airflow)" : "Failed (still air)"}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {explanation ? (
        <Panel className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-flame">
            <Sparkles aria-hidden className="h-4 w-4" /> Why these rank highest
          </h2>
          <p className="leading-relaxed">{explanation}</p>
          <p className="mt-2 text-xs text-faint">AI-written from the rubric&apos;s own reasons only. The rules decide the ranking; the AI only explains it.</p>
        </Panel>
      ) : null}

      {isPartial ? (
        <div className="space-y-4">
          <KnownGaps compact />
          {pinned.map((r) => (
            <Panel key={r.psi_id} className="border-ion/50 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ion">
                <Orbit aria-hidden className="h-4 w-4" /> Closest to partial gravity
              </p>
              <p className="mt-2">
                <Link href={`/investigations/${r.psi_id}`} className="font-semibold hover:text-flame">
                  {displayName(r.acronym, r.psi_id)} ({r.psi_id})
                </Link>{" "}
                — {r.title}. It used an electric field to mimic partial gravity. Score here: {r.total}/100.
              </p>
            </Panel>
          ))}
        </div>
      ) : null}

      <section aria-labelledby="ranking-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="ranking-title" className="text-xl font-semibold tracking-tight">
            Ranked for {current.label}
            <span className="block text-sm font-normal text-muted">
              {FOCUS_LABEL[state.focus]} · ventilation {state.vent === "ventilated" ? "working" : "failed"} · 24 NASA investigations
            </span>
          </h2>
          <CriteriaLegend />
        </div>
        {results === null ? (
          <p role="status" className="rounded-xl border border-line bg-panel p-6 text-muted">
            Loading ranking…
          </p>
        ) : singlePillar ? (
          <>
            <Group title={`${FOCUS_LABEL[state.focus]} experiments`} items={matching} start={1} facts={facts} />
            <Group title="Other experiments" items={others} start={matching.length + 1} facts={facts} />
          </>
        ) : (
          <ol className="space-y-3">
            {results.map((r, i) => (
              <RankedCard key={r.psi_id} result={r} rank={i + 1} facts={facts[r.psi_id]} />
            ))}
          </ol>
        )}
        <CompareTray />
      </section>
    </div>
  );
}

function Group({ title, items, start, facts }: { title: string; items: RankedResult[]; start: number; facts: CardFacts }) {
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-3 pt-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {title} <span className="font-mono text-faint">({items.length})</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </h3>
      <ol start={start} className="space-y-3">
        {items.map((r, i) => (
          <RankedCard key={r.psi_id} result={r} rank={start + i} facts={facts[r.psi_id]} />
        ))}
      </ol>
    </div>
  );
}
