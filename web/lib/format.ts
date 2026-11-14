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
  return lo === hi ? `${fmtNumber(lo)} ${unit}` : `${fmtNumber(lo)}–${fmtNumber(hi)} ${unit}`;
}

export function displayName(acronym: string, psiId: string): string {
  return acronym && acronym !== NOT_REPORTED ? acronym : psiId;
}

export function psiUrl(psiId: string): string {
  return `https://psi.nasa.gov/physci/repo/data/investigations/${psiId}`;
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}

export const CHALLENGE_URL = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";
