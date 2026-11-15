import { CRITERIA } from "@/lib/format";
import type { BreakdownItem } from "@/lib/types";

/** 5-segment bar: each segment's width is its criterion's max share of 100; the fill is points earned. */
export function ScoreBar({ breakdown }: { breakdown: BreakdownItem[] }) {
  const byKey = Object.fromEntries(breakdown.map((b) => [b.criterion, b]));
  const summary = CRITERIA.map(({ key, letter }) => `${letter} ${byKey[key]?.points ?? 0} of ${byKey[key]?.max ?? 0}`).join(", ");
  return (
    <div className="flex h-2.5 w-full gap-0.5" role="img" aria-label={`Score breakdown: ${summary}`}>
      {CRITERIA.map(({ key, color }) => {
        const b = byKey[key];
        if (!b) return null;
        return (
          <div key={key} className="h-full overflow-hidden rounded-sm bg-panel-3" style={{ flex: b.max }}>
            <div className="h-full rounded-sm" style={{ width: `${(b.points / b.max) * 100}%`, background: color }} />
          </div>
        );
      })}
    </div>
  );
}

export function CriteriaLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {CRITERIA.map(({ key, letter, label, color }) => (
        <li key={key} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2 w-3 rounded-sm" style={{ background: color }} />
          {letter} · {label}
        </li>
      ))}
    </ul>
  );
}
