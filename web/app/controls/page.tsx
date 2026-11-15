import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, CircleSlash, FlaskConical, Lightbulb, ShieldCheck, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";
import { AskChips } from "@/components/dashboard/parts";
import { ExternalLink } from "@/components/ui";
import { getInvestigations, getSources } from "@/lib/data";
import { CHALLENGE_URL, displayName, fmtNumber, NOT_REPORTED, PHASE_LABEL } from "@/lib/format";
import type { Investigation, Pillar, Source } from "@/lib/types";

export const metadata: Metadata = {
  title: "Fire-Safety Controls",
  description: "What NASA's combustion experiments say about preventing, detecting and suppressing fires in crewed habitats, what is still missing, and the Earth spin-offs.",
};

const MOON_O2 = 30; // Moon base / pressurized rover preset (AGENTS.md, challenge brief)

/** Fixed framing per pillar, from the challenge brief's "fire safety pillars"; everything else on the page is computed. */
const PILLARS: {
  key: Pillar;
  title: string;
  Icon: LucideIcon;
  question: string;
  informs: string;
  spinoff: string;
  ask: string[];
}[] = [
  {
    key: "prevention",
    title: "Prevention",
    Icon: ShieldCheck,
    question: "Which materials burn, at what oxygen level and airflow, and how fast does flame spread?",
    informs:
      "Material selection and flammability limits for cabins, suits and rovers; safe oxygen and pressure set-points; ventilation design. Large-scale solid-material tests (Saffire) and BASS/BASS-II measured how real spacecraft materials burn. ACME's BRE burned gaseous fuels, but studied how material properties set flammability in still air.",
    spinoff: "spinoff-fire-attire",
    ask: ["How does fire spread on fabric in microgravity?", "What are cool flames and why are they a risk?"],
  },
  {
    key: "detection",
    title: "Detection",
    Icon: BellRing,
    question: "What does smoke look like in microgravity, and can today's detectors see it?",
    informs:
      "Smoke-detector design for spacecraft: particle size and how smoke ages without buoyancy (SAME, SAME-R). DAFT/DAFT-2 reused the smoke instrument to measure dust.",
    spinoff: "spinoff-fire-detector",
    ask: ["How was smoke detection tested on the ISS, and why does it matter?"],
  },
  {
    key: "suppression",
    title: "Suppression",
    Icon: Wrench,
    question: "How do flames go out, and how much suppressant does a closed cabin need?",
    informs:
      "Extinguisher agents and amounts: FLEX burned fuel droplets in atmospheres diluted with carbon dioxide or helium to find when flames go out.",
    spinoff: "spinoff-air-tanks",
    ask: ["What gases were used to put out flames, and in which experiment?"],
  },
];

function span(records: Investigation[], key: "o2_percent_range" | "pressure_psi_range" | "airflow_cm_s_range") {
  const ranges = records.map((r) => r[key]).filter((x): x is [number, number] => x !== null);
  if (!ranges.length) return null;
  return { lo: Math.min(...ranges.map((r) => r[0])), hi: Math.max(...ranges.map((r) => r[1])), n: ranges.length };
}

/** One ruled row of what this pillar's experiments tested (DESIGN.md table rule, not KPI boxes). */
function CoverageTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <table className="w-full min-w-[36rem] text-sm">
      <thead>
        <tr className="border-b-2 border-rule text-left text-xs font-semibold text-ink">
          {rows.map(([label]) => (
            <th key={label} scope="col" className="font-cond py-1.5 pr-4 font-semibold">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-line align-top">
          {rows.map(([label, value, sub]) => (
            <td key={label} className="py-2 pr-4">
              <span className={"tabular block text-base font-semibold " + (value === "not reported" ? "text-faint" : "text-ink")}>{value}</span>
              <span className="text-xs text-muted">{sub}</span>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function SpinoffCard({ source }: { source: Source | undefined }) {
  if (!source) return null;
  return (
    <div className="border border-rule bg-panel p-4">
      <p className="text-xs font-semibold text-muted">Earth spin-off</p>
      <p className="mt-1 font-semibold">{source.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{source.summary}</p>
      <ExternalLink href={source.url} className="mt-2 inline-block text-sm">
        NASA Spinoff
      </ExternalLink>
    </div>
  );
}

function Finding({ r }: { r: Investigation }) {
  return (
    <li key={r.psi_id} className="border-b border-line py-3">
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/investigations/${r.psi_id}`} className="font-semibold hover:text-flame">
          {displayName(r.acronym, r.psi_id)}
        </Link>
        <span className="text-xs text-muted">
          {r.psi_id} · DOI <span className="font-mono">{r.doi}</span>
        </span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted line-clamp-4">
        {r.key_findings !== NOT_REPORTED ? r.key_findings : r.objective_summary !== NOT_REPORTED ? `Objective: ${r.objective_summary}` : "No findings text in PSI."}
      </p>
    </li>
  );
}

export default function ControlsPage() {
  const records = getInvestigations();
  const sources = new Map(getSources().map((s) => [s.id, s]));
  const basic = records.filter((r) => !r.pillars.length);

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm text-muted">Next-generation fire-safety equipment</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Fire-safety controls: what NASA has learned</h1>
        <p className="mt-1 text-muted">
          NASA groups spacecraft fire safety into three pillars. For each one: which experiments inform it, what they found,
          what equipment it shapes, and what data is still missing for a Moon base or rover at {MOON_O2}% oxygen.
        </p>
        <nav aria-label="Pillars" className="mt-4 flex flex-wrap gap-2">
          {PILLARS.map((p) => (
            <a key={p.key} href={`#${p.key}`} className="inline-flex min-h-9 items-center border border-rule px-3 text-sm text-ink hover:bg-panel-2">
              {p.title}
            </a>
          ))}
          <a href="#basic" className="inline-flex min-h-9 items-center border border-rule px-3 text-sm text-ink hover:bg-panel-2">Basic science</a>
          <a href="#spinoffs" className="inline-flex min-h-9 items-center border border-rule px-3 text-sm text-ink hover:bg-panel-2">Earth spin-offs</a>
        </nav>
      </header>

      {PILLARS.map((p) => {
        // Most data-rich first (test rows), so the strongest evidence leads.
        const members = records.filter((r) => r.pillars.includes(p.key)).sort((a, b) => b.tests.length - a.tests.length);
        const SHOW = 5;
        const o2 = span(members, "o2_percent_range");
        const pressure = span(members, "pressure_psi_range");
        const airflow = span(members, "airflow_cm_s_range");
        const atMoon = members.filter((r) => r.o2_percent_range && r.o2_percent_range[1] >= MOON_O2);
        const tables = members.filter((r) => r.tests.length).length;
        const phases = [...new Set(members.map((r) => PHASE_LABEL[r.fuel_phase]))];
        const gaps = [
          atMoon.length
            ? `Only ${atMoon.length} of ${members.length} report oxygen at or above ${MOON_O2}% (${atMoon.map((r) => displayName(r.acronym, r.psi_id)).join(", ")}).`
            : `None of the ${members.length} report a test at ${MOON_O2}% oxygen or more, the planned Moon-base level.`,
          pressure
            ? `Pressure is reported for ${pressure.n} of ${members.length}${pressure.lo > 10.2 ? `, and none below ${fmtNumber(pressure.lo)} psi` : ""}.`
            : `None report cabin pressure, so low-pressure habitats (≤ 10.2 psi) are untested here.`,
          `No experiment ran in real Moon gravity.`,
        ];
        return (
          <section key={p.key} id={p.key} aria-labelledby={`${p.key}-title`} className="scroll-mt-20 border border-rule bg-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center border border-rule text-ink">
                  <p.Icon aria-hidden className="h-5 w-5" />
                </span>
                <div>
                  <h2 id={`${p.key}-title`} className="text-2xl font-semibold tracking-tight text-ink">{p.title}</h2>
                  <p className="text-muted">{p.question}</p>
                </div>
              </div>
              <Link href={`/?scenario=moon_base&focus=${p.key}`} className="inline-flex items-center gap-1 text-sm text-ion hover:underline">
                Rank for a Moon base <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-5 border-2 border-flame-fill p-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                <TriangleAlert aria-hidden className="h-4 w-4 text-flame" /> Still missing for a Moon base or rover
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink">
                {gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label={p.title + " coverage (scrollable)"}>
              <CoverageTable
                rows={[
                  ["Investigations", String(members.length), tables + " with NASA test tables"],
                  ["Oxygen tested", o2 ? fmtNumber(o2.lo) + "–" + fmtNumber(o2.hi) + "%" : "not reported", o2 ? "reported by " + o2.n + " of " + members.length : "no oxygen values"],
                  ["Pressure tested", pressure ? fmtNumber(pressure.lo) + "–" + fmtNumber(pressure.hi) + " psi" : "not reported", pressure ? "reported by " + pressure.n + " of " + members.length : "no pressure values"],
                  ["Airflow tested", airflow ? fmtNumber(airflow.lo) + "–" + fmtNumber(airflow.hi) + " cm/s" : "not reported", airflow ? "reported by " + airflow.n + " of " + members.length : "no airflow values"],
                ]}
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                  <FlaskConical aria-hidden className="h-4 w-4" /> What the experiments found
                </h3>
                <ul className="border-t border-line">
                  {members.slice(0, SHOW).map((r) => (
                    <Finding key={r.psi_id} r={r} />
                  ))}
                </ul>
                {members.length > SHOW ? (
                  <details className="group mt-3">
                    <summary className="text-sm text-ion underline decoration-ion/40 underline-offset-4">
                      <span className="group-open:hidden">Show {members.length - SHOW} more</span>
                      <span className="hidden group-open:inline">Show fewer</span>
                    </summary>
                    <ul className="mt-3 border-t border-line">
                      {members.slice(SHOW).map((r) => (
                        <Finding key={r.psi_id} r={r} />
                      ))}
                    </ul>
                  </details>
                ) : null}
                <p className="mt-2 text-xs text-faint">Findings are extracted from each investigation&apos;s PSI text, each backed by a verbatim quote. Fuel types: {phases.join(", ")}.</p>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <div className="border border-line bg-panel-2 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Lightbulb aria-hidden className="h-4 w-4" /> Equipment it informs
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{p.informs}</p>
                  <p className="mt-2 text-xs text-faint">
                    Framing from the <ExternalLink href={CHALLENGE_URL}>NASA Space Apps challenge brief</ExternalLink>.
                  </p>
                </div>
                <SpinoffCard source={sources.get(p.spinoff)} />
                <AskChips questions={p.ask} />
              </div>
            </div>
          </section>
        );
      })}

      <section id="basic" aria-labelledby="basic-title" className="scroll-mt-20 border border-rule bg-panel p-5 sm:p-6">
        <h2 id="basic-title" className="flex items-center gap-2 text-lg font-medium">
          <CircleSlash aria-hidden className="h-5 w-5 text-faint" /> Basic combustion science (no pillar)
        </h2>
        <p className="mt-1 text-sm text-muted">
          These {basic.length} investigations study flame structure and soot. Their PSI text doesn&apos;t name prevention,
          detection or suppression as an aim, so we don&apos;t assign a pillar (the reason is recorded for each on its page).
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {basic.map((r) => (
            <li key={r.psi_id}>
              <Link href={`/investigations/${r.psi_id}`} className="inline-flex min-h-9 items-center gap-1.5 border border-rule px-3 text-sm hover:bg-panel-2">
                {displayName(r.acronym, r.psi_id)} <span className="text-xs text-muted">{r.psi_id}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="spinoffs" aria-labelledby="spinoffs-title" className="scroll-mt-20">
        <h2 id="spinoffs-title" className="mb-1 text-2xl font-semibold tracking-tight text-ink">Earth spin-offs</h2>
        <p className="mb-4 text-sm text-muted">NASA technology now used by firefighters and safety engineers on Earth.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PILLARS.map((p) => (
            <SpinoffCard key={p.spinoff} source={sources.get(p.spinoff)} />
          ))}
          <div className="cell-empty border border-rule bg-panel p-4">
            <p className="text-xs font-semibold text-muted">Named in the challenge brief · no PSI water-mist data</p>
            <p className="mt-1 font-semibold">Fine-water-mist extinguishers</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The challenge brief: &ldquo;Fine-water-mist extinguishers developed for use on the ISS have practical applications here on Earth.&rdquo; None of the 24 PSI investigations is a water-mist test.
            </p>
            <ExternalLink href={CHALLENGE_URL} className="mt-2 inline-block text-sm">
              NASA Space Apps challenge
            </ExternalLink>
          </div>
        </div>
      </section>
    </div>
  );
}
