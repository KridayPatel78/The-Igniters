import type { Criterion, FuelPhase, Gravity, Pillar, Range } from "./types";

export const NOT_REPORTED = "not reported";

export const CRITERIA: { key: Criterion; letter: string; label: string; color: string }[] = [
  { key: "oxygen", letter: "A", label: "Oxygen closeness", color: "var(--color-crit-oxygen)" },
  { key: "flow", letter: "B", label: "Flow regime", color: "var(--color-crit-flow)" },
  { key: "material", letter: "C", label: "Material relevance", color: "var(--color-crit-material)" },
  { key: "pillars", letter: "D", label: "Pillar coverage", color: "var(--color-crit-pillars)" },
  { key: "richness", letter: "E", label: "Data richness", color: "var(--color-crit-richness)" },
];

export const PHASE_LABEL: Record<FuelPhase, string> = {
  solid: "Solid fuel",
  liquid_droplet: "Liquid droplets",
  gas: "Gaseous fuel",
  mixed: "Mixed fuels",
};

export const GRAVITY_LABEL: Record<Gravity, string> = {
  microgravity: "Microgravity",
  normal: "Normal gravity (1 g)",
  partial_mimic: "Partial gravity (mimicked by electric field)",
};

export const PILLAR_LABEL: Record<Pillar, string> = {
  prevention: "Prevention",
  detection: "Detection",
  suppression: "Suppression",
};

export function fmtNumber(x: number): string {
  return Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10);
}

export function fmtRange(r: Range, unit: string): string {
  if (!r) return NOT_REPORTED;
  const [lo, hi] = r;
  // Non-breaking space keeps a number and its unit on one line.
  const u = unit ? ` ${unit}` : "";
  return lo === hi ? `${fmtNumber(lo)}${u}` : `${fmtNumber(lo)}–${fmtNumber(hi)}${u}`;
}

/** Short labels for the five ground/modeling studies that have no acronym in PSI (taken from their PSI titles). */
export const SHORT_NAMES: Record<string, string> = {
  "PSI-60": "SPICE data analysis",
  "PSI-62": "Flame-spread modeling",
  "PSI-115": "SAME data modeling",
  "PSI-117": "Cool-flame perturbation",
  "PSI-142": "Cool-flame transitions",
};

export function displayName(acronym: string, psiId: string): string {
  return acronym && acronym !== NOT_REPORTED ? acronym : (SHORT_NAMES[psiId] ?? psiId);
}

/** Fuel-phase colours for charts (unknown/mixed = neutral). */
export const PHASE_COLOR: Record<FuelPhase, string> = {
  solid: "var(--color-series-1)",
  liquid_droplet: "var(--color-series-2)",
  gas: "var(--color-series-3)",
  mixed: "var(--color-series-other)",
};

/** Upper end of a tested range, or null. */
export function rangeMax(r: Range): number | null {
  return r ? r[1] : null;
}

/** Prefilled question link for the AI librarian. */
export function askHref(q: string): string {
  return `/ask?q=${encodeURIComponent(q)}`;
}

export function psiUrl(psiId: string): string {
  return `https://psi.nasa.gov/physci/repo/data/investigations/${psiId}`;
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}

export const CHALLENGE_URL = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";

/**
 * Hardware families from the challenge brief ("Hardware" consideration) and AGENTS.md: experiments in
 * the same family share apparatus, so their results are the most directly comparable.
 */
export interface Family {
  key: string;
  label: string;
  hardware: string;
  note: string;
  members: string[];
}
export const FAMILIES: Family[] = [
  {
    key: "acme",
    label: "ACME gas flames",
    hardware: "Modular ACME hardware in the Combustion Integrated Rack (CIR)",
    note: "Six experiments with gaseous-fuel flames. BRE emulates how solid materials burn in still air; E-FIELD mimics partial gravity with an electric field; CFI-G reached up to 85% O₂.",
    members: ["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"],
  },
  {
    key: "droplets",
    label: "Burning droplets",
    hardware: "Multi-user Droplet Combustion Apparatus (MDCA) in the CIR",
    note: "Liquid fuel droplets; FLEX and FLEX-2 tested how flames go out, CFI studied cool flames.",
    members: ["PSI-69", "PSI-68", "PSI-39"],
  },
  {
    key: "msg-duct",
    label: "Flow-duct solids & co-flow flames",
    hardware: "Microgravity Science Glovebox (MSG) with the fan-driven SPICE flow duct",
    note: "Solid samples (BASS, BASS-II) and gas jet flames (SPICE, SLICE) in the same duct.",
    members: ["PSI-26", "PSI-25", "PSI-107", "PSI-106"],
  },
  {
    key: "saffire",
    label: "Large-scale spacecraft fires",
    hardware: "Saffire enclosure on the Cygnus cargo vehicle, after it left the ISS",
    note: "Large samples of real cabin materials (SIBAL fabric, Nomex, PMMA, silicone) burned in a flow duct.",
    members: ["PSI-98", "PSI-99", "PSI-100"],
  },
  {
    key: "smoke",
    label: "Smoke & dust detection",
    hardware: "Smoke-measurement instruments (the SAME instrument was reused by DAFT for dust)",
    note: "How smoke particles form and age in microgravity, and whether detectors can tell smoke from dust.",
    members: ["PSI-102", "PSI-101", "PSI-47"],
  },
  {
    key: "ground",
    label: "Ground & modeling studies",
    hardware: "No flight hardware of their own",
    note: "Analysis, modeling and ground experiments that build on the flight data (SPICE, BASS, SAME, cool flames).",
    members: ["PSI-60", "PSI-62", "PSI-115", "PSI-117", "PSI-142"],
  },
];
export const FAMILY_OF: Record<string, Family> = Object.fromEntries(FAMILIES.flatMap((f) => f.members.map((m) => [m, f])));

/** Why each habitat's atmosphere matters (challenge brief, "Spacesuits and oxygen concentration"). */
export const SCENARIO_NOTE: Record<string, string> = {
  iss_cabin: "Earth-like air: 21% O₂ at 14.7 psi, the baseline most fire tests were run at.",
  moon_base:
    "Planned ≥ 30% O₂ at ≤ 10.2 psi to shorten pre-breathing before moonwalks: over 40% more O₂ than Earth air, so materials burn more readily.",
  mars_habitat: "Assumed to match the Moon base (≥ 30% O₂, ≤ 10.2 psi) until NASA sets a Mars atmosphere.",
  spacesuit: "100% O₂ at only 4.3 psi so the suit stays flexible: the most oxygen-rich environment crews live in.",
};

/**
 * Element-style symbols for the investigation table (Chart of the Evidence). Labels only, derived from each
 * acronym or PSI title; the full name always sits under the symbol.
 */
export const SYMBOL: Record<string, string> = {
  "PSI-10": "Fd", "PSI-20": "Br", "PSI-21": "Cd", "PSI-22": "Ef", "PSI-23": "Sf", "PSI-159": "Cg",
  "PSI-69": "Fx", "PSI-68": "F2", "PSI-39": "Cf",
  "PSI-26": "Bs", "PSI-25": "B2", "PSI-107": "Sp", "PSI-106": "Sl",
  "PSI-98": "S1", "PSI-99": "S2", "PSI-100": "S3",
  "PSI-102": "Sm", "PSI-101": "Sr", "PSI-47": "Df",
  "PSI-60": "Sa", "PSI-62": "Fs", "PSI-115": "Md", "PSI-117": "Cp", "PSI-142": "Ct",
};

/** Cell fill per fuel family (DESIGN.md cell code). */
export const FAMILY_FILL: Record<string, string> = {
  solid: "var(--color-fuel-solid)",
  liquid_droplet: "var(--color-fuel-liquid)",
  gas: "var(--color-fuel-gas)",
  unknown: "var(--color-fuel-unknown)",
  mixed: "var(--color-fuel-unknown)",
};
export const FAMILY_LABEL: Record<string, string> = {
  solid: "Solid fuel",
  liquid_droplet: "Liquid droplets",
  gas: "Gaseous fuel",
  unknown: "Mixed / unknown",
  mixed: "Mixed / unknown",
};

/** CSS background for a cell holding one or more fuel families (split diagonally, as the nuclide chart does). */
export function familyBackground(families: string[]): string {
  if (!families.length) return "transparent";
  if (families.length === 1) return FAMILY_FILL[families[0]];
  const step = 100 / families.length;
  return `linear-gradient(135deg, ${families.map((f, i) => `${FAMILY_FILL[f]} ${i * step}% ${(i + 1) * step}%`).join(", ")})`;
}
