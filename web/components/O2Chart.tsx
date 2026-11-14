import { displayName, fmtRange } from "@/lib/format";
import type { InvestigationLite, Scenario } from "@/lib/types";

const COLORS = ["#ff8a4c", "#5ec2ff", "#b49cff", "#44d39b"];

/** Each investigation's tested O2 range against the scenario targets (21, 30, 100 %). */
export function O2Chart({ items, scenarios }: { items: InvestigationLite[]; scenarios: Scenario[] }) {
  const width = 640;
  const left = 120;
  const right = 20;
  const rowH = 34;
  const top = 40;
  const height = top + items.length * rowH + 30;
  const x = (pct: number) => left + (pct / 100) * (width - left - right);
  const targets = [...new Map(scenarios.map((s) => [s.o2_percent, s])).values()].map((s) => ({
    pct: s.o2_percent,
    label: scenarios.filter((t) => t.o2_percent === s.o2_percent).map((t) => t.label.split(" (")[0].split(" /")[0]).join(" / "),
  }));
  const summary = items.map((r) => `${displayName(r.acronym, r.psi_id)}: ${fmtRange(r.o2_percent_range, "% O2")}`).join("; ");

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Oxygen tested versus scenario targets. ${summary}`}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 6} y2={height - 26} stroke="var(--color-line)" />
            <text x={x(t)} y={height - 10} textAnchor="middle" fontSize="11" fill="var(--color-faint)">
              {t}%
            </text>
          </g>
        ))}
        {targets
          .sort((a, b) => a.pct - b.pct)
          .map((t, i, all) => {
            // Labels sit beside their line, never across it: first and last point outward, the rest right.
            const toLeft = i === 0 || (i === all.length - 1 && t.pct >= 90);
            return (
              <g key={t.pct}>
                <line x1={x(t.pct)} x2={x(t.pct)} y1={top - 12} y2={height - 26} stroke="var(--color-flame)" strokeDasharray="4 3" />
                <text x={x(t.pct) + (toLeft ? -5 : 5)} y={top - 14} textAnchor={toLeft ? "end" : "start"} fontSize="11" fill="var(--color-flame)">
                  {t.label} {t.pct}%
                </text>
              </g>
            );
          })}
        {items.map((r, i) => {
          const y = top + i * rowH + rowH / 2;
          const range = r.o2_percent_range;
          return (
            <g key={r.psi_id}>
              <text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="var(--color-ink)">
                {displayName(r.acronym, r.psi_id).slice(0, 16)}
              </text>
              {range ? (
                <rect
                  x={x(range[0])}
                  y={y - 7}
                  width={Math.max(4, x(range[1]) - x(range[0]))}
                  height={14}
                  rx={4}
                  fill={COLORS[i % COLORS.length]}
                />
              ) : (
                <text x={x(0) + 6} y={y + 4} fontSize="12" fill="var(--color-faint)">
                  not reported
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-sm text-muted">
        Bars: oxygen range tested (from PSI experimental tables). Dashed lines: scenario targets.
      </figcaption>
    </figure>
  );
}
