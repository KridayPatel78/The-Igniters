"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import type { CardFacts } from "@/lib/data";
import { CRITERIA, fmtRange, NOT_REPORTED, PHASE_LABEL, PILLAR_LABEL, rangeMax } from "@/lib/format";
import type { RankedResult } from "@/lib/types";
import { CompareToggle } from "../CompareToggle";
import { ScoreBar } from "../ScoreBar";

type SortKey = "rank" | "name" | "total" | "o2" | "pressure" | "airflow" | "tests";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "rank", label: "#", className: "w-10" },
  { key: "name", label: "Investigation" },
  { key: "total", label: "Score" },
  { key: "o2", label: "O₂ tested" },
  { key: "pressure", label: "Pressure" },
  { key: "airflow", label: "Airflow" },
];

function Missing() {
  return (
    <span className="cell-empty inline-flex whitespace-nowrap border border-line px-1.5 py-0.5 text-[11px] text-muted" title="Not reported in NASA's experimental tables">
      not reported
    </span>
  );
}

/** Sortable table of the current ranking; each row expands to the rubric's reasons. */
export function RankingTable({ results, facts, singlePillar }: { results: RankedResult[]; facts: CardFacts; singlePillar: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const ranked = results.map((r, i) => ({ r, rank: i + 1, f: facts[r.psi_id] }));
  const value = (x: (typeof ranked)[number]): number | string | null => {
    switch (sort.key) {
      case "rank": return x.rank;
      case "name": return x.f.name.toLowerCase();
      case "total": return x.r.total;
      case "o2": return rangeMax(x.f.o2);
      case "pressure": return rangeMax(x.f.pressure);
      case "airflow": return rangeMax(x.f.airflow);
      case "tests": return x.f.tests;
    }
  };
  const rows = [...ranked].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return a.rank - b.rank;
    if (va === null) return 1; // "not reported" always last
    if (vb === null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : a.rank - b.rank) * sort.dir;
  });
  const grouped = singlePillar && sort.key === "rank" && sort.dir === 1;
  const firstOther = grouped ? rows.findIndex((x) => !x.r.matches_focus) : -1;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" || key === "rank" ? 1 : -1 }));
  }
  function toggleRow(id: string) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Ranking table (scrollable)">
      <table className="w-full min-w-[940px] text-sm">
        <thead>
          <tr className="font-cond border-b-2 border-rule text-left text-sm font-semibold text-ink">
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className={`px-2.5 py-2.5 font-medium ${c.className ?? ""}`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                  {c.label}
                  {sort.key === c.key ? (sort.dir === 1 ? <ArrowUp aria-hidden className="h-3 w-3" /> : <ArrowDown aria-hidden className="h-3 w-3" />) : null}
                </button>
              </th>
            ))}
            <th scope="col" className="px-2.5 py-2.5 font-medium">Fuel · pillars</th>
            <th scope="col" className="px-2.5 py-2.5 font-medium">
              <button type="button" onClick={() => toggleSort("tests")} className="inline-flex items-center gap-1 hover:text-ink">
                Tests
                {sort.key === "tests" ? (sort.dir === 1 ? <ArrowUp aria-hidden className="h-3 w-3" /> : <ArrowDown aria-hidden className="h-3 w-3" />) : null}
              </button>
            </th>
            <th scope="col" className="px-2.5 py-2.5 font-medium"><span className="sr-only">Compare</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => {
            const { r, f, rank } = x;
            const expanded = open.has(r.psi_id);
            const by = Object.fromEntries(r.breakdown.map((b) => [b.criterion, b]));
            return (
              <Fragment key={r.psi_id}>
                {grouped && i === 0 && r.matches_focus ? <GroupRow label="Matches your safety focus" /> : null}
                {grouped && i === firstOther ? <GroupRow label="Other experiments" /> : null}
                <tr className={`border-b border-line/70 align-middle transition-colors hover:bg-panel-2 ${expanded ? "bg-panel-2/40" : ""}`}>
                  <td className="tabular px-2.5 py-2.5 text-right text-[13px] text-faint">{rank}</td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleRow(r.psi_id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} why ${f.name} scored ${r.total}`}
                        className="-ml-1 grid h-11 w-11 shrink-0 place-items-center sm:h-7 sm:w-7 rounded-lg text-faint hover:bg-panel-3 hover:text-ink"
                      >
                        <ChevronRight aria-hidden className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
                      </button>
                      <div className="min-w-0">
                        <Link href={`/investigations/${r.psi_id}`} className="font-semibold hover:text-flame">
                          {f.name}
                        </Link>
                        <span className="ml-2 text-[13px] text-faint">{r.psi_id}</span>
                        <span className="block max-w-[13rem] truncate text-xs text-muted" title={r.title}>{r.title}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="tabular w-10 text-base font-semibold text-ink">{r.total}</span>
                      <div className="w-20"><ScoreBar breakdown={r.breakdown} /></div>
                    </div>
                  </td>
                  <td className="tabular whitespace-nowrap px-2.5 py-2.5 text-[13px]">{f.o2 ? fmtRange(f.o2, "%") : <Missing />}</td>
                  <td className="tabular whitespace-nowrap px-2.5 py-2.5 text-[13px]">{f.pressure ? fmtRange(f.pressure, "psi") : <Missing />}</td>
                  <td className="tabular whitespace-nowrap px-2.5 py-2.5 text-[13px]">{f.airflow ? fmtRange(f.airflow, "cm/s") : <Missing />}</td>
                  <td className="px-2.5 py-2.5 text-xs">
                    <span className="text-ink">{f.phase_unknown ? "Fuel unknown" : PHASE_LABEL[f.fuel_phase]}</span>
                    <span className="block text-muted">{f.pillars.length ? f.pillars.map((p) => PILLAR_LABEL[p]).join(", ") : "No pillar"}</span>
                  </td>
                  <td className="tabular px-2.5 py-2.5 text-right text-[13px]">{f.tests || <span className="text-faint">none</span>}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-xs"><CompareToggle id={r.psi_id} compact /></td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-line/70 bg-panel-2/40">
                    <td />
                    <td colSpan={8} className="px-3 pb-4 pt-1">
                      <p className="mb-2 text-xs font-semibold text-muted">Why {r.total}/100</p>
                      <ul className="grid gap-1.5 text-sm md:grid-cols-2">
                        {CRITERIA.map((c) => {
                          const b = by[c.key];
                          return b ? (
                            <li key={c.key} className="grid grid-cols-[auto_1fr] gap-x-2">
                              <span className="flex items-center gap-1.5 text-[13px] tabular-nums text-ink">
                                <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: c.color }} />
                                {c.letter} {b.points}/{b.max}
                              </span>
                              <span className="text-muted">
                                <span className="sr-only">{c.label}: </span>
                                {b.reason}
                              </span>
                            </li>
                          ) : null;
                        })}
                      </ul>
                      {r.notes.length ? <p className="mt-2 text-xs text-faint">{r.notes.join(" ")}</p> : null}
                      <p className="mt-2 text-xs">
                        <Link href={`/investigations/${r.psi_id}`} className="text-ion underline decoration-ion/40 underline-offset-4">
                          Full details and NASA test table
                        </Link>
                        {f.doi && f.doi !== NOT_REPORTED ? <span className="ml-3 font-mono text-faint">DOI {f.doi}</span> : null}
                      </p>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={9} className="border-b border-rule bg-panel-2 px-2.5 py-1.5 text-xs font-semibold text-ink">
        {label}
      </td>
    </tr>
  );
}
