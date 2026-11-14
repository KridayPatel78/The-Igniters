import type { Metadata } from "next";
import { Suspense } from "react";
import { Compare } from "@/components/Compare";
import { getCardFacts, getInvestigations, getScenarios, toLite } from "@/lib/data";

export const metadata: Metadata = { title: "Compare", description: "Compare 2–4 NASA combustion investigations side by side." };

export default function ComparePage() {
  const records = getInvestigations().map(toLite);
  const facts = getCardFacts();
  const phaseUnknown = Object.keys(facts).filter((id) => facts[id].phase_unknown);
  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Compare investigations</h1>
        <p className="text-muted">
          Put 2 to 4 investigations side by side: every Data-contract field, plus the oxygen they were tested at against
          each habitat&apos;s target. The selection is saved in the link, so you can share it.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Loading comparison…</p>}>
        <Compare records={records} scenarios={getScenarios().scenarios} phaseUnknown={phaseUnknown} />
      </Suspense>
    </div>
  );
}
