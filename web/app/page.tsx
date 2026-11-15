import { Suspense } from "react";
import { Explore } from "@/components/Explore";
import { ExploreView, type ExploreState } from "@/components/ExploreView";
import { getCardFacts, getExplanations, getExplorer, getMeta, getRanking, getScenarios, rankingKey } from "@/lib/data";
import { buildEvidence, type Family } from "@/lib/evidence";

export default function DashboardPage() {
  const { scenarios, focuses, partial_gravity_scenarios } = getScenarios();
  const moon = scenarios.find((s) => s.key === "moon_base") ?? scenarios[0];
  const defaultState: ExploreState = { scenario: moon.key, focus: "all", vent: moon.ventilation };
  const defaultResults = getRanking(rankingKey(moon.key, "all", moon.ventilation)).results;
  const explanations = Object.fromEntries(Object.entries(getExplanations()).map(([k, v]) => [k, v.explanation]));
  const facts = getCardFacts();
  const testRows = getMeta().counts.test_rows ?? 0;
  const familyOf = (id: string): Family => {
    const f = facts[id];
    return !f || f.phase_unknown || f.fuel_phase === "mixed" ? "unknown" : f.fuel_phase;
  };
  const evidence = buildEvidence(getExplorer().rows, familyOf);
  const shared = { scenarios, focuses, partialGravity: partial_gravity_scenarios, facts, testRows, evidence };

  return (
    <Suspense
      fallback={
        <ExploreView {...shared} state={defaultState} results={defaultResults} explanation={explanations[rankingKey(moon.key, "all", moon.ventilation)]} />
      }
    >
      <Explore {...shared} defaultState={defaultState} defaultResults={defaultResults} explanations={explanations} />
    </Suspense>
  );
}
