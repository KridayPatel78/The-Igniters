import type { Metadata } from "next";
import { Suspense } from "react";
import { Compare } from "@/components/Compare";
import { sampleSizes } from "@/lib/variables";
import { getCardFacts, getInvestigations, getRanking, getScenarios, rankingKey, toLite } from "@/lib/data";

export const metadata: Metadata = { title: "Compare", description: "Compare 2–4 NASA combustion investigations side by side." };

export default function ComparePage() {
  const full = getInvestigations();
  const records = full.map(toLite);
  const sizes = Object.fromEntries(
    full
      .map((r) => [r.psi_id, sampleSizes(r.tests, 3).map((z) => `${z.column}: ${z.values.join(", ")}${z.more ? ` +${z.more} more` : ""}`).join("; ")])
      .filter(([, v]) => v),
  );
  const facts = getCardFacts();
  const phaseUnknown = Object.keys(facts).filter((id) => facts[id].phase_unknown);
  const scenarios = getScenarios().scenarios;
  const breakdowns = Object.fromEntries(
    scenarios.map((s) => [
      s.key,
      Object.fromEntries(getRanking(rankingKey(s.key, "all", s.ventilation)).results.map((r) => [r.psi_id, { total: r.total, breakdown: r.breakdown }])),
    ]),
  );
  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Compare investigations</h1>
        <p className="text-muted">
          Put 2 to 4 investigations side by side: their score profile, the conditions they tested, and every field with
          what&apos;s the same and what differs. The selection is saved in the link, so you can share it.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Loading comparison…</p>}>
        <Compare records={records} scenarios={scenarios} phaseUnknown={phaseUnknown} breakdowns={breakdowns} sizes={sizes} />
      </Suspense>
    </div>
  );
}
