"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import type { Cell, Evidence, Family, Strip } from "@/lib/evidence";
import { FAMILY_LABEL, familyBackground, fmtNumber } from "@/lib/format";

interface Names {
  [psi: string]: { name: string; symbol: string };
}

const FAMILIES: Family[] = ["solid", "liquid_droplet", "gas", "unknown"];
const range = (edges: number[], i: number) => `${fmtNumber(edges[i])}–${fmtNumber(edges[i + 1])}`;

function InvestigationList({ items, names }: { items: { psi_id: string; count: number }[]; names: Names }) {
  return (
    <ul className="mt-2 divide-y divide-line border-y border-line text-sm">
      {items.map((i) => (
        <li key={i.psi_id} className="flex items-baseline justify-between gap-3 py-1.5">
          <Link href={`/investigations/${i.psi_id}`} className="min-w-0 truncate text-ion underline decoration-ion/30 underline-offset-2 hover:decoration-ion">
            {names[i.psi_id]?.name ?? i.psi_id}
          </Link>
          <span className="tabular shrink-0 text-muted">
            {i.count.toLocaleString("en-US")} {i.count === 1 ? "row" : "rows"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FamilyKey({ counts }: { counts?: Record<Family, number> }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {FAMILIES.map((f) => (
        <li key={f} className="flex items-center gap-2">
          <span aria-hidden className="h-3.5 w-3.5 shrink-0 border border-rule" style={{ background: familyBackground([f]) }} />
          <span className={counts && counts[f] === 0 ? "text-faint" : "text-ink"}>
            {FAMILY_LABEL[f]}
            {counts ? <span className="tabular ml-1 font-semibold">{counts[f]}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tested oxygen (across) × pressure (up). Filled cells: NASA ran tests there (fill = fuel family, number = test rows).
 * Hatched cells: never tested. The red frame is the selected habitat; it glides when the habitat changes.
 */
export function EvidenceChart({
  evidence,
  scenarioKey,
  names,
  note,
  showGravity = false,
  subject,
}: {
  evidence: Evidence;
  scenarioKey: string;
  names: Names;
  /** one-line habitat context shown in the reading panel */
  note?: string;
  /** add the gravity row (Moon / Mars: no tests) under the chart */
  showGravity?: boolean;
  /** when the chart holds one investigation's rows only, name it so sentences stay scoped */
  subject?: string;
}) {
  const { o2Edges, pEdges, cells, strip, regions, totals, noO2 } = evidence;
  const cols = o2Edges.length - 1;
  const rows = pEdges.length - 1;
  // Several cells can be selected: click toggles a cell, Shift+click selects the rectangle from the last cell.
  // Keys: "o2:p" for chart cells, "s:o2" for the no-pressure strip.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const byKey = new Map(cells.map((c) => [`${c.o2}:${c.p}`, c]));
  const stripByKey = new Map(strip.map((x) => [`s:${x.o2}`, x]));
  const region = regions[scenarioKey] ?? regions.moon_base;

  function pick(key: string, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && anchor && !anchor.startsWith("s:") && !key.startsWith("s:")) {
        const [a0, a1] = anchor.split(":").map(Number);
        const [b0, b1] = key.split(":").map(Number);
        for (let o = Math.min(a0, b0); o <= Math.max(a0, b0); o++)
          for (let p = Math.min(a1, b1); p <= Math.max(a1, b1); p++) if (byKey.has(`${o}:${p}`)) next.add(`${o}:${p}`);
      } else if (shift && anchor?.startsWith("s:") && key.startsWith("s:")) {
        const a = Number(anchor.slice(2));
        const b = Number(key.slice(2));
        for (let o = Math.min(a, b); o <= Math.max(a, b); o++) if (stripByKey.has(`s:${o}`)) next.add(`s:${o}`);
      } else if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setAnchor(key);
  }
  function selectHabitat() {
    const next = new Set<string>();
    for (let o = region.o2[0]; o <= region.o2[1]; o++)
      for (let p = region.p[0]; p <= region.p[1]; p++) if (byKey.has(`${o}:${p}`)) next.add(`${o}:${p}`);
    setSelected(next);
    setAnchor(null);
  }
  const clear = () => {
    setSelected(new Set());
    setAnchor(null);
  };
  const picked = [...selected]
    .map((k) => (k.startsWith("s:") ? stripByKey.get(k) : byKey.get(k)))
    .filter((c): c is Cell | Strip => Boolean(c));
  const selCount = picked.reduce((n, c) => n + c.count, 0);
  const selInv = [
    ...picked.flatMap((c) => c.investigations).reduce((m, i) => m.set(i.psi_id, (m.get(i.psi_id) ?? 0) + i.count), new Map<string, number>()),
  ]
    .map(([psi_id, count]) => ({ psi_id, count }))
    .sort((a, b) => b.count - a.count);
  const selHasStrip = [...selected].some((k) => k.startsWith("s:"));
  const cellName = (k: string) => {
    if (k.startsWith("s:")) return `${range(o2Edges, Number(k.slice(2)))}% O₂, no psi`;
    const [o, p] = k.split(":").map(Number);
    return `${range(o2Edges, o)}% O₂ × ${range(pEdges, p)} psi`;
  };
  const habitatCells = cells.filter((c) => c.o2 >= region.o2[0] && c.o2 <= region.o2[1] && c.p >= region.p[0] && c.p <= region.p[1]).length;

  const frame = {
    left: `${(region.o2[0] / cols) * 100}%`,
    width: `${((region.o2[1] - region.o2[0] + 1) / cols) * 100}%`,
    top: `${((rows - 1 - region.p[1]) / rows) * 100}%`,
    height: `${((region.p[1] - region.p[0] + 1) / rows) * 100}%`,
  };
  const solidMissing = region.count > 0 && region.families.solid === 0;
  const lunar = scenarioKey === "moon_base" || scenarioKey === "mars_habitat";
  // Moon-base limits drawn as rules: the 30% O₂ column edge and the 10.2 psi row edge.
  const o2Rule = o2Edges.indexOf(30);
  const pRule = pEdges.indexOf(10.2);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <figure className="min-w-0">
        <div className="overflow-x-auto pb-2" tabIndex={0} role="region" aria-label="Chart of the evidence (scrollable on small screens)">
          <div className="min-w-[44rem]">
            <p className="mb-1 w-16 pr-2 text-right text-[11px] font-semibold text-ink" aria-hidden>
              psi ↑
            </p>
            <div className="flex">
              {/* pressure axis */}
              <div className="flex w-16 shrink-0 flex-col" aria-hidden>
                {Array.from({ length: rows }, (_, k) => rows - 1 - k).map((p) => (
                  <div key={p} className="tabular flex h-11 items-center justify-end pr-2 text-[11px] text-muted">
                    {range(pEdges, p)}
                  </div>
                ))}
              </div>
              {/* cells */}
              <div className="relative flex-1 border-2 border-rule">
                <div className="grid gap-px bg-rule" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rows }, (_, k) => rows - 1 - k).flatMap((p) =>
                    Array.from({ length: cols }, (_, o2) => {
                      const key = `${o2}:${p}`;
                      const c = byKey.get(key);
                      if (!c) return <div key={key} className="cell-empty h-11 bg-bg" />;
                      const label = `${range(o2Edges, o2)}% oxygen, ${range(pEdges, p)} psi: ${c.count} test rows from ${c.investigations
                        .map((i) => names[i.psi_id]?.name ?? i.psi_id)
                        .join(", ")}`;
                      const active = selected.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={(e) => pick(key, e.shiftKey)}
                          aria-pressed={active}
                          aria-label={label}
                          title={label}
                          className={`tabular relative h-11 text-[11px] font-semibold text-ink transition-[filter] hover:brightness-95 ${active ? "z-10 outline-3 -outline-offset-3 outline-rule" : ""}`}
                          style={{ background: familyBackground(c.families) }}
                        >
                          {c.count}
                        </button>
                      );
                    }),
                  )}
                </div>
                {/* Moon-base limits: 30% O₂ and 10.2 psi */}
                {o2Rule > 0 ? (
                  <div aria-hidden className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-dashed border-flame" style={{ left: `${(o2Rule / cols) * 100}%` }} />
                ) : null}
                {pRule > 0 ? (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-flame" style={{ top: `${((rows - pRule) / rows) * 100}%` }} />
                ) : null}
                {/* habitat target frame */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-20 border-[3px] border-flame-fill transition-[left,top,width,height] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                  style={frame}
                />
              </div>
            </div>
            {/* oxygen axis */}
            <div className="ml-16 grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-hidden>
              {Array.from({ length: cols }, (_, o2) => (
                <div key={o2} className="tabular pt-1 text-center text-[11px] text-muted">
                  {range(o2Edges, o2)}
                </div>
              ))}
            </div>
            <p className="ml-16 mt-1 text-[11px] font-semibold text-ink">Oxygen, % by volume →</p>
            {/* strip: oxygen reported, pressure not */}
            <div className="mt-4 flex items-center">
              <div className="w-16 shrink-0 pr-2 text-right text-[11px] leading-tight text-muted">no psi reported</div>
              <div className="grid flex-1 gap-px border border-rule bg-rule" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {Array.from({ length: cols }, (_, o2) => {
                  const s = strip.find((x) => x.o2 === o2);
                  if (!s) return <div key={o2} className="cell-empty h-8 bg-bg" />;
                  const label = `${range(o2Edges, o2)}% oxygen, pressure not reported: ${s.count} rows from ${s.investigations.map((i) => names[i.psi_id]?.name ?? i.psi_id).join(", ")}`;
                  const key = `s:${o2}`;
                  const active = selected.has(key);
                  return (
                    <button
                      key={o2}
                      type="button"
                      onClick={(e) => pick(key, e.shiftKey)}
                      aria-pressed={active}
                      title={label}
                      aria-label={label}
                      className={`tabular relative grid h-8 place-items-center text-[11px] font-semibold text-ink transition-[filter] hover:brightness-95 ${active ? "z-10 outline-3 -outline-offset-3 outline-rule" : ""}`}
                      style={{ background: familyBackground(s.families) }}
                    >
                      {s.count}
                    </button>
                  );
                })}
              </div>
            </div>
            {showGravity ? (
              <div className="mt-2 flex items-center">
                <div className="w-16 shrink-0 pr-2 text-right text-[11px] leading-tight text-muted">gravity</div>
                <div className="grid flex-1 grid-cols-[2fr_1fr_1fr] gap-px border border-rule bg-rule text-[12px]">
                  <div className="flex h-9 items-center bg-panel-3 px-2 font-semibold text-ink">
                    Microgravity: all {totals.rows.toLocaleString("en-US")} rows
                  </div>
                  {[
                    ["moon_base", "Moon 0.16 g"],
                    ["mars_habitat", "Mars 0.38 g"],
                  ].map(([key, label]) => (
                    <div
                      key={key}
                      className={`cell-empty flex h-9 items-center bg-bg px-2 ${scenarioKey === key ? "relative z-10 outline-[3px] -outline-offset-[3px] outline-flame-fill" : ""}`}
                    >
                      <span className="font-semibold text-ink">{label}</span>
                      <span className="ml-1 text-flame">no tests</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <figcaption className="mt-3 max-w-prose text-sm leading-relaxed text-body">
          {totals.placed.toLocaleString("en-US")} of {totals.rows.toLocaleString("en-US")} NASA test rows report both oxygen and pressure, from{" "}
          {totals.investigationsPlaced} investigations. {totals.o2Only} more report oxygen only (bottom strip).{" "}
          {totals.noO2.toLocaleString("en-US")} report no oxygen at all, so they can&apos;t be placed:{" "}
          {noO2
            .slice(0, 5)
            .map((i) => `${names[i.psi_id]?.name ?? i.psi_id} (${i.count})`)
            .join(", ")}
          {noO2.length > 5 ? ` and ${noO2.length - 5} more` : ""}.{" "}
          <Link href="/explorer" className="text-ion underline underline-offset-2">
            See every row
          </Link>
        </figcaption>
      </figure>

      <aside aria-label="Reading" className="space-y-5" aria-live="polite">
        {picked.length ? (
          <section className="border-2 border-rule p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">
                {picked.length === 1 ? `Cell ${cellName([...selected][0])}` : `${picked.length} cells selected`}
              </h3>
              <button type="button" onClick={clear} className="-mr-1 -mt-1 grid h-10 w-10 place-items-center hover:bg-panel-2" aria-label="Clear cell selection">
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
            {picked.length > 1 ? <p className="mt-1 text-xs leading-relaxed text-muted">{[...selected].map(cellName).join(" · ")}</p> : null}
            <p className="tabular mt-1 text-sm text-body">
              {selCount.toLocaleString("en-US")} test rows from {selInv.length} investigation{selInv.length === 1 ? "" : "s"}
            </p>
            <InvestigationList items={selInv} names={names} />
            <Link
              href={`/explorer?need=${selHasStrip ? "o2" : "o2,pressure"}${selInv.length === 1 ? `&inv=${selInv[0].psi_id}` : ""}`}
              className="mt-3 inline-flex min-h-8 items-center text-sm text-ion underline underline-offset-2"
            >
              Open these rows in the Data Explorer
            </Link>
          </section>
        ) : null}

        <section className="border-2 border-flame-fill p-4">
          <h3 className="text-base font-semibold text-ink">{region.label}</h3>
          <p className="text-sm text-muted">{region.rule}</p>
          {note ? <p className="mt-2 text-sm leading-relaxed text-body">{note}</p> : null}
          <p className="mt-3 text-[15px] leading-relaxed text-ink">
            {region.count === 0 ? (
              <>
                {subject ? (
                  <>
                    <span className="font-semibold text-flame">None of {subject}&apos;s test rows</span> fall inside this region.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-flame">No NASA test</span> in PSI was run at these conditions.
                  </>
                )}
              </>
            ) : (
              <>
                <span className="tabular font-semibold">{region.count.toLocaleString("en-US")}</span> of {totals.rows.toLocaleString("en-US")} test rows fall inside
                this region, from {region.investigations.length} investigation{region.investigations.length === 1 ? "" : "s"}.
              </>
            )}
            {solidMissing ? (
              <>
                {" "}
                <span className="font-semibold text-flame">None burned a solid material</span> such as the fabrics and plastics a crew cabin is made of.
              </>
            ) : null}
            {lunar ? (
              <>
                {" "}
                And <span className="font-semibold text-flame">none ran in {scenarioKey === "moon_base" ? "Moon" : "Mars"} gravity</span>: every PSI test is microgravity.
              </>
            ) : null}
          </p>
          <div className="mt-3">
            <FamilyKey counts={region.families} />
          </div>
          {region.investigations.length ? <InvestigationList items={region.investigations} names={names} /> : null}
          <p className="mt-3 text-sm leading-relaxed text-body">
            No partial-gravity combustion data exists in PSI yet (LUCI and FM2 are planned). The closest:{" "}
            <Link href="/investigations/PSI-22" className="text-ion underline underline-offset-2">
              ACME E-FIELD Flames
            </Link>{" "}
            mimicked partial gravity with an electric field; microgravity and 1 g results bound the space between.
          </p>
        </section>

        <section className="border border-rule bg-panel-2 p-4">
          <h3 className="text-sm font-semibold text-ink">Key</h3>
          <div className="mt-2">
            <FamilyKey />
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span aria-hidden className="cell-empty h-3.5 w-3.5 shrink-0 border border-rule bg-bg" /> Never tested
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 border-[3px] border-flame-fill" /> Selected habitat
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-0 w-3.5 shrink-0 border-t-2 border-dashed border-flame" /> Moon-base limits: 30% O₂, 10.2 psi
            </li>
            <li className="text-muted">
              Number in a cell = test rows. Click cells to select several; Shift+click selects a range. The bottom strip is clickable too.
            </li>
          </ul>
          {habitatCells ? (
            <button type="button" onClick={selectHabitat} className="mt-3 min-h-10 border border-rule bg-bg px-3 text-left text-sm text-ink hover:bg-panel-2">
              Select the {habitatCells} tested cell{habitatCells === 1 ? "" : "s"} in the habitat frame
            </button>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
