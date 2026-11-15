"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { MAX_COMPARE, useCompare } from "@/lib/compareStore";

export function CompareToggle({ id, compact = false }: { id: string; compact?: boolean }) {
  const { ids, toggle } = useCompare();
  const selected = ids.includes(id);
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={selected}
      aria-label={compact ? `Compare ${id}` : undefined}
      className={`inline-flex min-h-7 items-center gap-1 border px-2.5 py-1 text-sm font-medium transition-colors ${
        selected ? "border-rule bg-rule text-white" : "border-rule bg-bg text-ink hover:bg-panel-2"
      }`}
    >
      {selected ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Plus aria-hidden className="h-3.5 w-3.5" />}
      {compact ? (selected ? "Added" : "Compare") : selected ? "In compare" : "Add to compare"}
    </button>
  );
}

/** Sticky "Compare (n)" bar shown once something is selected. */
export function CompareTray() {
  const { ids, set } = useCompare();
  if (!ids.length) return null;
  return (
    <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 border-2 border-rule bg-dark px-4 py-3 text-on-dark shadow-pop" role="status" aria-live="polite">
      <p className="text-sm">
        <span className="font-semibold">{ids.length}</span> of {MAX_COMPARE} selected: <span className="font-mono text-on-dark-soft">{ids.join(", ")}</span>
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => set([])} className="min-h-9 rounded-lg px-3 py-1.5 text-sm text-on-dark-soft hover:text-on-dark">
          Clear
        </button>
        <Link
          href={`/compare?ids=${ids.join(",")}`}
          className={`inline-flex min-h-9 items-center rounded-lg px-4 py-1.5 text-sm font-medium ${ids.length >= 2 ? "bg-white text-ink hover:bg-panel-3" : "pointer-events-none bg-dark-2 text-on-dark-soft"}`}
          aria-disabled={ids.length < 2}
        >
          {ids.length >= 2 ? `Compare ${ids.length} selected` : "Pick at least 2"}
        </Link>
      </div>
    </div>
  );
}
