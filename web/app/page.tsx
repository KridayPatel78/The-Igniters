import { Suspense } from "react";
import { Explore } from "@/components/Explore";
import { ExploreView, type ExploreState } from "@/components/ExploreView";
import { getCardFacts, getExplanations, getRanking, getScenarios, rankingKey } from "@/lib/data";

export default function ExplorePage() {
  const { scenarios, focuses, partial_gravity_scenarios } = getScenarios();
  const moon = scenarios.find((s) => s.key === "moon_base") ?? scenarios[0];
  const defaultState: ExploreState = { scenario: moon.key, focus: "all", vent: moon.ventilation };
  const defaultResults = getRanking(rankingKey(moon.key, "all", moon.ventilation)).results;
  const explanations = Object.fromEntries(Object.entries(getExplanations()).map(([k, v]) => [k, v.explanation]));
  const facts = getCardFacts();
  const shared = { scenarios, focuses, partialGravity: partial_gravity_scenarios, facts };

  return (
    <div className="space-y-10">
      <section className="max-w-3xl space-y-4 pt-4">
        <p className="font-mono text-sm uppercase tracking-widest text-flame">NASA microgravity combustion · 24 investigations</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Which NASA fire experiments matter most for the habitat you&apos;re designing?
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          Without gravity there is no buoyant airflow, so flames spread, smoke drifts and fires go out differently than on
          Earth. A planned Moon base or pressurized rover may run at about 30% oxygen and 10.2 psi, which is over 40% more
          oxygen than Earth air, and makes materials much more flammable. Pick a habitat to rank NASA&apos;s experiments,
          with a reason for every point.
        </p>
      </section>
      <Suspense
        fallback={
          <ExploreView {...shared} state={defaultState} results={defaultResults} explanation={explanations[rankingKey(moon.key, "all", moon.ventilation)]} />
        }
      >
        <Explore {...shared} defaultState={defaultState} defaultResults={defaultResults} explanations={explanations} />
      </Suspense>
    </div>
  );
}
