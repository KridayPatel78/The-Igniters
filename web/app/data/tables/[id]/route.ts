import { getInvestigation, getInvestigations } from "@/lib/data";

// One investigation's experimental-table rows as CSV, exactly as in NASA's PSI files (all columns),
// plus the PSI ID and DOI so the citation travels with the data. Prerendered at build time.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getInvestigations()
    .filter((r) => r.tests.length)
    .map((r) => ({ id: `${r.psi_id}.csv` }));
}

function cell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = getInvestigation(id.replace(/\.csv$/, ""));
  if (!r) return new Response("not found", { status: 404 });
  const columns = [...new Set(r.tests.flatMap((t) => Object.keys(t)))];
  const header = ["psi_id", "doi", ...columns];
  const lines = [header, ...r.tests.map((t) => [r.psi_id, r.doi, ...columns.map((c) => t[c] ?? "")])];
  return new Response(lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${r.psi_id}_tests.csv"` },
  });
}
