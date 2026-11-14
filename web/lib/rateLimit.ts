// Best-effort, in-memory, per-IP sliding window (per serverless instance). Protects the public
// free-tier Gemini key from casual abuse; it is not a security boundary.

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit = 10,
    private readonly windowMs = 60_000,
  ) {}

  /** True if this request is allowed (and records it). */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (!times.some((t) => now - t < this.windowMs)) this.hits.delete(key);
    }
  }
}

export interface AskInput {
  ok: true;
  question: string;
}
export interface AskInputError {
  ok: false;
  status: number;
  message: string;
}

/** Validate the raw request body text: JSON {question: non-empty string <= maxChars}, body <= maxBytes. */
export function parseAskBody(body: string, maxChars: number, maxBytes = 2048): AskInput | AskInputError {
  if (Buffer.byteLength(body, "utf-8") > maxBytes) return { ok: false, status: 413, message: "Request too large." };
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, status: 400, message: "Send JSON like {\"question\": \"...\"}." };
  }
  const question = (data as { question?: unknown })?.question;
  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, status: 400, message: "Please type a question." };
  }
  if (question.trim().length > maxChars) {
    return { ok: false, status: 400, message: `Questions are limited to ${maxChars} characters.` };
  }
  return { ok: true, question: question.trim() };
}
