import { getRanking, rankingKeys } from "@/lib/data";

// The 24 precomputed rankings, prerendered at build time as static JSON (no scoring in TypeScript).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return rankingKeys().map((key) => ({ key }));
}

export async function GET(_request: Request, ctx: RouteContext<"/data/rankings/[key]">) {
  const { key } = await ctx.params;
  return Response.json(getRanking(key));
}
