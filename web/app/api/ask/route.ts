import "server-only";

import { answer, numberCitations } from "@/lib/rag/answer";
import { embedQuery, generateAnswer, ragState } from "@/lib/rag/server";
import { parseAskBody, RateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const limiter = new RateLimiter(10, 60_000);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!limiter.allow(ip)) {
    return json({ error: "Too many questions in a minute - please wait a moment and try again." }, 429);
  }
  const { cfg, prompt, index, demo } = ragState();
  const parsed = parseAskBody(await request.text(), cfg.answer.max_question_chars);
  if (!parsed.ok) return json({ error: parsed.message }, parsed.status);

  const cached = demo.find((d) => d.question.toLowerCase() === parsed.question.toLowerCase());
  if (cached) return json(numberCitations(cached));

  // Gemini outages never surface as a 500: answer() falls back to passages / keyword search.
  const result = await answer(parsed.question, {
    cfg,
    index,
    prompt,
    embed: (q) => embedQuery(q, cfg),
    generate: (p) => generateAnswer(p, cfg),
  });
  return json(result);
}
