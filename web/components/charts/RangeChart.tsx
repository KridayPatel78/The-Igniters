"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtRange } from "@/lib/format";
import type { Range } from "@/lib/types";

export interface RangeItem {
  id: string;
  name: string;
  range: Range;
  color?: string;
}
export interface Target {
  value: number;
  label: string;
}

interface Datum {
  id: string;
  name: string;
  real: [number, number];
  bar: [number, number];
  color: string;
}

function TargetLabel({ viewBox, label, anchor, row }: { viewBox?: { x: number; y: number }; label: string; anchor: "start" | "end"; row: number }) {
  if (!viewBox) return null;
  return (
    <text x={viewBox.x + (anchor === "end" ? -4 : 4)} y={12 + row * 13} textAnchor={anchor} fontSize={11} fill="var(--color-flame)">
      {label}
    </text>
  );
}

/**
 * Each item's tested range (from PSI experimental tables) as a horizontal bar, with dashed lines
 * for habitat targets. Items without a reported range are listed under the chart, never drawn.
 */
export function RangeChart({
  items,
  unit,
  domain,
  targets = [],
  ticks,
}: {
  items: RangeItem[];
  unit: string;
  domain: [number, number];
  targets?: Target[];
  ticks?: number[];
}) {
  const span = domain[1] - domain[0];
  const pad = span * 0.004; // single values (lo = hi) still get a visible sliver; tooltips show the real value
  const data: Datum[] = items
    .filter((i) => i.range)
    .map((i) => {
      const [lo, hi] = i.range as [number, number];
      return {
        id: i.id,
        name: i.name,
        real: [lo, hi],
        bar: [Math.max(domain[0], lo - pad), Math.min(domain[1], hi + pad)],
        color: i.color ?? "var(--color-series-1)",
      };
    });
  const missing = items.filter((i) => !i.range);
  const height = Math.max(1, data.length) * 28 + 56;
  const sortedTargets = [...targets].sort((a, b) => a.value - b.value);
  // Labels of targets closer than 15% of the axis go on alternating rows so they never overlap.
  const rows = sortedTargets.map((t, i) => (i > 0 && t.value - sortedTargets[i - 1].value < span * 0.15 ? 1 : 0));
  for (let i = 1; i < rows.length; i++) if (rows[i] && rows[i - 1]) rows[i] = 0;
  const stagger = rows.some(Boolean);

  return (
    <figure className="space-y-2">
      {data.length ? (
        <div style={{ height }} className="w-full" role="img" aria-label={`Tested ${unit} ranges: ${data.map((d) => `${d.name} ${fmtRange(d.real, unit)}`).join("; ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: stagger ? 34 : 22, right: 16, bottom: 0, left: 4 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke="var(--color-line)" strokeDasharray="2 4" />
              <XAxis
                type="number"
                domain={domain}
                ticks={ticks}
                allowDataOverflow
                tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}`}
              />
              <YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--color-ink)", fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
              <Tooltip
                cursor={{ fill: "rgb(20 20 19 / 0.04)" }}
                content={({ active, payload }) => {
                  const d = active && payload?.length ? (payload[0].payload as Datum) : null;
                  return d ? (
                    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-pop">
                      <p className="font-semibold text-ink">{d.name}</p>
                      <p className="font-mono text-muted">
                        {fmtRange(d.real, unit)} <span className="text-faint">· {d.id}</span>
                      </p>
                    </div>
                  ) : null;
                }}
              />
              {sortedTargets.map((t, i) => (
                <ReferenceLine
                  key={t.label}
                  x={t.value}
                  stroke="var(--color-flame-fill)"
                  strokeDasharray="4 3"
                  ifOverflow="hidden"
                  label={<TargetLabel label={t.label} anchor={(i === 0 && sortedTargets.length > 1) || t.value >= domain[1] - span * 0.15 ? "end" : "start"} row={rows[i]} />}
                />
              ))}
              <Bar dataKey="bar" radius={4} isAnimationActive={false} fill="var(--color-series-1)">
                {data.map((d) => (
                  <Cell key={d.id} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-faint">None of these report a tested {unit} range.</p>
      )}
      {missing.length ? (
        <figcaption className="text-xs text-faint">
          Not reported in NASA&apos;s tables: {missing.map((m) => m.name).join(", ")}.
        </figcaption>
      ) : null}
    </figure>
  );
}
