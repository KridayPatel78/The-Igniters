"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CardFacts } from "@/lib/data";
import type { Evidence } from "@/lib/evidence";
import type { Focus, RankedResult, RankingFile, Scenario, Ventilation } from "@/lib/types";
import { ExploreView, type ExploreState } from "./ExploreView";

interface Props {
  scenarios: Scenario[];
  focuses: Focus[];
  partialGravity: string[];
  defaultState: ExploreState;
  defaultResults: RankedResult[];
  explanations: Record<string, string>;
  facts: CardFacts;
  testRows: number;
  evidence: Evidence;
}

/** Reads ?scenario=&focus=&vent= and loads that precomputed ranking (static JSON). */
export function Explore({ scenarios, focuses, partialGravity, defaultState, defaultResults, explanations, facts, testRows, evidence }: Props) {
  const params = useSearchParams();
  const scenario = scenarios.find((s) => s.key === params.get("scenario")) ?? scenarios.find((s) => s.key === defaultState.scenario)!;
  const focusParam = params.get("focus") as Focus | null;
  const ventParam = params.get("vent") as Ventilation | null;
  const state: ExploreState = {
    scenario: scenario.key,
    focus: focusParam && focuses.includes(focusParam) ? focusParam : "all",
    vent: ventParam === "ventilated" || ventParam === "quiescent" ? ventParam : scenario.ventilation,
  };
  const key = `${state.scenario}__${state.focus}__${state.vent}`;
  const defaultKey = `${defaultState.scenario}__${defaultState.focus}__${defaultState.vent}`;
  const [loaded, setLoaded] = useState<{ key: string; results: RankedResult[] } | null>(null);

  useEffect(() => {
    if (key === defaultKey) return;
    let cancelled = false;
    fetch(`/data/rankings/${key}`)
      .then((r) => r.json() as Promise<RankingFile>)
      .then((data) => {
        if (!cancelled) setLoaded({ key, results: data.results });
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [key, defaultKey]);

  const results = key === defaultKey ? defaultResults : loaded?.key === key ? loaded.results : null;

  return (
    <ExploreView
      scenarios={scenarios}
      focuses={focuses}
      partialGravity={partialGravity}
      state={state}
      results={results}
      explanation={explanations[key]}
      facts={facts}
      testRows={testRows}
      evidence={evidence}
    />
  );
}
