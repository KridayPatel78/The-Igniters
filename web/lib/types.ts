// Types mirroring the Data contract (AGENTS.md) and the files written by scripts/export_web.py.

export type FuelPhase = "solid" | "liquid_droplet" | "gas" | "mixed";
export type Gravity = "microgravity" | "normal" | "partial_mimic";
export type Pillar = "prevention" | "detection" | "suppression";
export type Range = [number, number] | null;

export interface Investigation {
  psi_id: string;
  acronym: string;
  title: string;
  doi: string;
  platform: string;
  hardware: string;
  fuel_phase: FuelPhase;
  fuels: string[];
  o2_percent_range: Range;
  pressure_psi_range: Range;
  airflow_cm_s_range: Range;
  gravity: Gravity;
  pillars: Pillar[];
  measurements: string[];
  objective_summary: string;
  key_findings: string;
  earth_applications: string;
  tests: Record<string, string>[];
  source_urls: string[];
  extraction_confidence: "checked" | "llm_unchecked";
}

/** Investigation without the (large) test rows, for client components. */
export type InvestigationLite = Omit<Investigation, "tests"> & { test_count: number; test_tables: string[] };

export type ProvenanceValue =
  | string
  | string[]
  | { source: string; quote?: string; quotes?: string[]; placeholder?: boolean; reason?: string };
export type Provenance = Record<string, Record<string, ProvenanceValue>>;

export type Criterion = "oxygen" | "flow" | "material" | "pillars" | "richness";
export interface BreakdownItem {
  criterion: Criterion;
  points: number;
  max: number;
  reason: string;
  inputs: Record<string, unknown>;
}
export interface RankedResult {
  psi_id: string;
  acronym: string;
  title: string;
  total: number;
  breakdown: BreakdownItem[];
  matches_focus: boolean;
  notes: string[];
  callouts: string[];
}
export interface RankingFile {
  scenario: string;
  focus: Focus;
  ventilation: Ventilation;
  results: RankedResult[];
}

export type Focus = "all" | Pillar;
export type Ventilation = "ventilated" | "quiescent";
export interface Scenario {
  key: string;
  label: string;
  o2_percent: number;
  pressure_psi: number;
  ventilation: Ventilation;
}
export interface Scenarios {
  scenarios: Scenario[];
  focuses: Focus[];
  ventilations: Ventilation[];
  partial_gravity_scenarios: string[];
}

export interface Explanation {
  scenario: string;
  focus: Focus;
  ventilation: Ventilation;
  explanation: string;
  mode: "llm" | "offline";
  top3: { psi_id: string; acronym: string; total: number }[];
}

export interface Source {
  id: string;
  title: string;
  url: string;
  type: "experiment_data" | "text" | "video";
  used_in: string[];
  note?: string;
  pdf_url?: string;
  summary?: string;
  summary_quote?: string | null;
  summary_mode?: "llm" | "first_sentences";
}

export interface Meta {
  exported_at: string;
  data_commit: string;
  counts: Record<string, number>;
  models: { embedding: string; answer: string; extraction: string[] };
  explanations: Record<string, number>;
  source_summaries: Record<string, number>;
}

// --- AI librarian -------------------------------------------------------------------------

export type AnswerMode = "llm" | "passages" | "not_covered";

/** Citation as produced by the Python pipeline (demo_answers.json). */
export interface RawCitation {
  label: string;
  source_type: "psi" | "resource";
  url?: string;
  psi_id?: string;
  doi?: string;
  acronym?: string;
  title?: string;
}

/** Citation as returned by /api/ask and shown in the UI. */
export interface Citation {
  n: number;
  label: string;
  href: string;
  source_type: "psi" | "resource";
}

export interface AskResponse {
  question: string;
  answer: string;
  citations: Citation[];
  covered: boolean;
  mode: AnswerMode;
}

export interface DemoAnswer {
  id: number;
  question: string;
  answer: string;
  citations: RawCitation[];
  covered: boolean;
  mode: AnswerMode;
}
