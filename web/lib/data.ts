// Typed loaders for web/data/ (written by `python -m scripts.export_web`). Read at build time
// by server components and static route handlers. The site never computes scores: rankings come
// from rankings/<scenario>__<focus>__<ventilation>.json.

import fs from "node:fs";
import path from "node:path";
import { displayName } from "./format";
import type { RagConfig } from "./rag/config";
import type {
  DemoAnswer,
  ExplorerData,
  Explanation,
  Focus,
  Investigation,
  InvestigationLite,
  Meta,
  Provenance,
  RankingFile,
  Scenarios,
  Source,
  Ventilation,
} from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");

const cache = new Map<string, unknown>();

function readJson<T>(name: string): T {
  if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf-8")));
  return cache.get(name) as T;
}

export function readText(name: string): string {
  return fs.readFileSync(path.join(DATA_DIR, name), "utf-8");
}

export const getInvestigations = () => readJson<Investigation[]>("investigations.json");
export const getProvenance = () => readJson<Provenance>("provenance.json");
export const getScenarios = () => readJson<Scenarios>("scenarios.json");
export const getExplanations = () => readJson<Record<string, Explanation>>("explanations.json");
export const getDemoAnswers = () => readJson<DemoAnswer[]>("demo_answers.json");
export const getSources = () => readJson<Source[]>("sources.json");
export const getMeta = () => readJson<Meta>("meta.json");
export const getRagConfig = () => readJson<RagConfig>("rag_config.json");
export const getRubric = () => readText("rubric.md");
export const getExplorer = () => readJson<ExplorerData>("explorer.json");

export function getInvestigation(id: string): Investigation | undefined {
  return getInvestigations().find((r) => r.psi_id === id);
}

export function rankingKey(scenario: string, focus: Focus, ventilation: Ventilation): string {
  return `${scenario}__${focus}__${ventilation}`;
}

export function rankingKeys(): string[] {
  const s = getScenarios();
  return s.scenarios.flatMap((sc) => s.focuses.flatMap((f) => s.ventilations.map((v) => rankingKey(sc.key, f, v))));
}

export function getRanking(key: string): RankingFile {
  if (!rankingKeys().includes(key)) throw new Error(`unknown ranking ${key}`);
  return readJson<RankingFile>(path.join("rankings", `${key}.json`));
}

/** Contract fields minus the test rows (which can be hundreds per investigation). */
export function toLite(r: Investigation): InvestigationLite {
  const { tests, ...rest } = r;
  const tables = [...new Set(tests.map((t) => t._table).filter(Boolean))] as string[];
  return { ...rest, test_count: tests.length, test_tables: tables };
}

/** Small per-investigation facts the ranked cards need (chips, badges). */
export function getCardFacts() {
  const provenance = getProvenance();
  return Object.fromEntries(
    getInvestigations().map((r) => [
      r.psi_id,
      {
        name: displayName(r.acronym, r.psi_id),
        title: r.title,
        doi: r.doi,
        pillars: r.pillars,
        fuel_phase: r.fuel_phase,
        phase_unknown: isPlaceholder(provenance[r.psi_id]?.fuel_phase),
        unchecked: r.extraction_confidence === "llm_unchecked",
        gravity: r.gravity,
        o2: r.o2_percent_range,
        pressure: r.pressure_psi_range,
        airflow: r.airflow_cm_s_range,
        measurements: r.measurements.length,
        tests: r.tests.length,
      },
    ]),
  );
}

/** A value that only exists to satisfy the contract (scoring already treats it as unknown). */
export function isPlaceholder(p: Provenance[string][string] | undefined): boolean {
  return typeof p === "object" && p !== null && !Array.isArray(p) && p.placeholder === true;
}
export type CardFacts = ReturnType<typeof getCardFacts>;
