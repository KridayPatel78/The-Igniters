import { getExplorer } from "@/lib/data";

// Every experimental-table row (explorer.json), prerendered as static JSON for the Data Explorer.
export const dynamic = "force-static";

export function GET() {
  return Response.json(getExplorer());
}
