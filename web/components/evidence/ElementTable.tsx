"use client";

import { useState } from "react";
import type { CardFacts } from "@/lib/data";
import { FAMILIES, familyBackground, SYMBOL } from "@/lib/format";
import type { RankedResult } from "@/lib/types";
import { TileAnalysis } from "./TileAnalysis";

/**
 * The 24 investigations as an element table, one row ("period") per hardware family from the challenge brief.
 * Tile: PSI number (atomic-number corner), pillars, symbol, name, score for the selected habitat. Fill = fuel family.
 * Clicking a tile opens the analysis of its cleaned test rows directly under its row.
 */
export function ElementTable({ results, facts, habitat }: { results: RankedResult[]; facts: CardFacts; habitat: string }) {
  const rank = new Map(results.map((r, i) => [r.psi_id, { rank: i + 1, total: r.total }]));
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {FAMILIES.map((fam) => (
        <div
          key={fam.key}
          className={`grid gap-x-4 gap-y-2 lg:grid-cols-[13rem_minmax(0,1fr)] ${fam.key === "ground" ? "mt-8 border-t-2 border-dashed border-rule pt-6" : ""}`}
        >
          <div className="pt-1">
            <p className="text-sm font-semibold text-ink">{fam.label}</p>
            <p className="text-xs leading-snug text-muted">{fam.key === "ground" ? "No flight hardware: reanalysis of above investigations" : fam.hardware}</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {fam.members.map((id) => {
              const f = facts[id];
              const r = rank.get(id);
              if (!f) return null;
              const top = r && r.rank <= 3;
              const fill = familyBackground([f.phase_unknown || f.fuel_phase === "mixed" ? "unknown" : f.fuel_phase]);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setOpen(open === id ? null : id)}
                    aria-expanded={open === id}
                    aria-controls={`analysis-${id}`}
                    aria-label={`${f.name} (${id}): score ${r?.total ?? "n/a"} of 100 for ${habitat}, rank ${r?.rank ?? "n/a"} of 24${f.o2 ? "" : ", oxygen not reported"}. Show its data analysis`}
                    className={`group relative flex h-[7rem] w-[7.25rem] flex-col justify-between border border-rule p-1.5 text-left text-ink transition-transform hover:-translate-y-0.5 ${
                      top || open === id ? "outline-[3px] outline-offset-0 outline-rule" : ""
                    } ${open === id ? "-translate-y-0.5 shadow-[0_3px_0_var(--color-rule)]" : ""}`}
                    style={{ background: fill }}
                  >
                    <span className="flex items-start justify-between text-[11px] font-semibold leading-none">
                      <span className="tabular">{id.replace("PSI-", "")}</span>
                      <span className="tracking-wide">{f.pillars.map((p) => p[0].toUpperCase()).join(" ") || "–"}</span>
                    </span>
                    <span className="font-cond text-center text-[1.9rem] font-bold leading-none">{SYMBOL[id] ?? "?"}</span>
                    <span className="block">
                      <span className="block truncate text-[11px] font-medium leading-tight">{f.name}</span>
                      <span className="flex items-baseline justify-between text-[11px] leading-tight">
                        <span>{f.gravity === "partial_mimic" ? "partial-g mimic" : f.o2 ? "" : "no O₂ data"}</span>
                        <span className="tabular text-[12px] font-bold">{r?.total ?? "–"}</span>
                      </span>
                    </span>
                    {top ? (
                      <span className="tabular absolute -right-1.5 -top-2 bg-rule px-1 text-[11px] font-bold leading-4 text-white">#{r!.rank}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {open && fam.members.includes(open) && facts[open] ? (
            <div id={`analysis-${open}`} className="lg:col-span-2">
              <TileAnalysis
                key={open}
                psiId={open}
                name={facts[open].name}
                doi={facts[open].doi}
                score={`${rank.get(open)?.total ?? "n/a"}/100 (rank ${rank.get(open)?.rank ?? "n/a"} of 24)`}
                habitat={habitat}
                onClose={() => setOpen(null)}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Legend card: one tile at double size with its parts labelled. */
export function TileKey() {
  return (
    <figure className="flex items-center gap-4 border border-rule bg-panel-2 p-3" aria-label="How to read a tile">
      <span aria-hidden className="relative flex h-28 w-28 shrink-0 flex-col justify-between border border-rule p-2 text-ink" style={{ background: "var(--color-fuel-solid)" }}>
        <span className="flex justify-between text-xs font-semibold leading-none">
          <span className="tabular">98</span>
          <span>P</span>
        </span>
        <span className="font-cond text-center text-4xl font-bold leading-none">S1</span>
        <span className="flex items-baseline justify-between text-xs leading-none">
          <span>SAFFIRE-I</span>
          <span className="tabular font-bold">84.3</span>
        </span>
      </span>
      <figcaption className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs leading-snug text-body">
        <span className="font-semibold text-ink">top left</span> <span>PSI number</span>
        <span className="font-semibold text-ink">top right</span> <span>pillars: P prevention, D detection, S suppression</span>
        <span className="font-semibold text-ink">centre</span> <span>symbol</span>
        <span className="font-semibold text-ink">bottom</span> <span>name, and score for the chosen habitat</span>
        <span className="font-semibold text-ink">fill</span> <span>fuel: red solid, blue droplet, yellow gas, grey unknown</span>
        <span className="font-semibold text-ink">frame</span> <span>black frame + #n: top 3 for this habitat</span>
      </figcaption>
    </figure>
  );
}
