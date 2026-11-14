"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { MAX_COMPARE, useCompare } from "@/lib/compareStore";

export function CompareToggle({ id }: { id: string }) {
  const { ids, toggle } = useCompare();
  const selected = ids.includes(id);
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${
        selected ? "border-good/50 bg-good/10 text-good" : "border-line text-muted hover:text-ink"
      }`}
    >
      {selected ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Plus aria-hidden className="h-3.5 w-3.5" />}
      {selected ? "In compare" : "Add to compare"}
    </button>
  );
}

/** Sticky "Compare (n)" bar shown once something is selected. */
export function CompareTray() {
  const { ids, set } = useCompare();
  if (!ids.length) return null;
  return (
    <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ion/40 bg-panel-2/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="text-sm">
        <span className="font-semibold">{ids.length}</span> of {MAX_COMPARE} selected: <span className="font-mono text-muted">{ids.join(", ")}</span>
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => set([])} className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink">
          Clear
        </button>
        <Link
          href={`/compare?ids=${ids.join(",")}`}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${ids.length >= 2 ? "bg-ion text-bg" : "pointer-events-none bg-panel text-faint"}`}
          aria-disabled={ids.length < 2}
        >
          {ids.length >= 2 ? `Compare ${ids.length} selected` : "Pick at least 2"}
        </Link>
      </div>
    </div>
  );
}
