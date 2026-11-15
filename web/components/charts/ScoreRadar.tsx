"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { CRITERIA } from "@/lib/format";
import type { BreakdownItem } from "@/lib/types";

// First four categorical slots; the 4th is also dashed so it never relies on colour alone.
const SERIES = ["#111111", "#2a78d6", "#eb6834", "#1baf7a"];

export interface RadarItem {
  id: string;
  name: string;
  breakdown: BreakdownItem[];
}

/** Each investigation's five rubric criteria as % of the criterion's maximum. */
export function ScoreRadar({ items }: { items: RadarItem[] }) {
  const data = CRITERIA.map((c) => {
    const row: Record<string, string | number> = { criterion: `${c.letter} ${c.label}` };
    for (const it of items) {
      const b = it.breakdown.find((x) => x.criterion === c.key);
      row[it.id] = b ? Math.round((b.points / b.max) * 100) : 0;
      row[`${it.id}__pts`] = b ? `${b.points}/${b.max}` : "–";
    }
    return row;
  });
  const names = Object.fromEntries(items.map((i) => [i.id, i.name]));
  return (
    <div className="h-[340px] w-full" role="img" aria-label={`Score criteria compared: ${items.map((i) => `${i.name} ${i.breakdown.map((b) => `${b.criterion} ${b.points}/${b.max}`).join(", ")}`).join("; ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="var(--color-line)" />
          <PolarAngleAxis dataKey="criterion" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          {items.map((it, i) => (
            <Radar
              key={it.id}
              name={it.name}
              dataKey={it.id}
              stroke={SERIES[i]}
              strokeWidth={2}
              strokeDasharray={i === 3 ? "5 3" : undefined}
              fill={SERIES[i]}
              fillOpacity={0.12}
              dot={{ r: 3, fill: SERIES[i], strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-pop">
                  <p className="mb-1 font-semibold text-ink">{label}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="flex justify-between gap-4 text-muted">
                      <span>{names[String(p.dataKey)]}</span>
                      <span className="font-mono text-ink">{(p.payload as Record<string, string>)[`${String(p.dataKey)}__pts`]}</span>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => <span style={{ color: "var(--color-body)" }}>{value}</span>}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
