import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CardFacts } from "@/lib/data";
import { CRITERIA, displayName } from "@/lib/format";
import type { RankedResult } from "@/lib/types";
import { CompareToggle } from "./CompareToggle";
import { ScoreBar } from "./ScoreBar";
import { PhaseChip, PillarChips, UncheckedBadge } from "./ui";

export function RankedCard({ result, rank, facts }: { result: RankedResult; rank: number; facts: CardFacts[string] }) {
  const byKey = Object.fromEntries(result.breakdown.map((b) => [b.criterion, b]));
  const name = displayName(result.acronym, result.psi_id);
  return (
    <li className="rounded-xl border border-line bg-panel p-4 transition-colors hover:border-ion/40 sm:p-5">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-sm text-faint" aria-label={`Rank ${rank}`}>
          #{rank}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="min-w-0">
              <Link href={`/investigations/${result.psi_id}`} className="font-semibold hover:text-flame">
                {name}
              </Link>
              <span className="ml-2 font-mono text-xs text-faint">{result.psi_id}</span>
              <span className="block text-sm text-muted">{result.title}</span>
            </h3>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {result.total}
              <span className="text-sm font-normal text-faint">/100</span>
            </p>
          </div>
          <ScoreBar breakdown={result.breakdown} />
          <div className="flex flex-wrap items-center gap-1.5">
            <PillarChips pillars={facts.pillars} />
            <PhaseChip phase={facts.fuel_phase} unknown={facts.phase_unknown} />
            {facts.unchecked ? <UncheckedBadge /> : null}
          </div>
          <details className="group">
            <summary className="inline-flex items-center gap-1 rounded text-sm text-ion">
              <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
              Why this score
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {CRITERIA.map(({ key, letter, label, color }) => {
                const b = byKey[key];
                if (!b) return null;
                return (
                  <li key={key} className="grid grid-cols-[auto_1fr] gap-x-3">
                    <span className="font-mono tabular-nums" style={{ color }}>
                      {letter} {b.points}/{b.max}
                    </span>
                    <span>
                      <span className="sr-only">{label}: </span>
                      {b.reason}
                    </span>
                  </li>
                );
              })}
            </ul>
            {result.notes.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                {result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
          </details>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/investigations/${result.psi_id}`} className="text-ion underline decoration-ion/40 underline-offset-4">
              Details and test table
            </Link>
            <CompareToggle id={result.psi_id} />
          </div>
        </div>
      </div>
    </li>
  );
}
