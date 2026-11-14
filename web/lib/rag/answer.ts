// Answering - a 1:1 port of rag/ask.py (prompt, citation mapping, NOT_COVERED handling and the
// offline fallbacks). Gemini calls are injected so every path is testable without a key.

import type { AnswerMode, AskResponse, Citation, RawCitation } from "../types";
import type { RagConfig } from "./config";
import { keywordRetrieve, retrieve, type Chunk, type Hit, type RagIndex } from "./retrieve";

export interface AnswerDeps {
  index: RagIndex;
  cfg: RagConfig;
  prompt: string; // rag_prompt.md
  embed: (question: string) => Promise<ArrayLike<number>>;
  generate: (prompt: string) => Promise<string>;
}

interface RawAnswer {
  question: string;
  answer: string;
  citations: RawCitation[];
  covered: boolean;
  mode: AnswerMode;
}

const CITE = /\[(S\d+(?:\s*[,;]\s*S?\d+)*)\]/g;

export function buildPrompt(template: string, question: string, sources: string, cfg: RagConfig): string {
  return template
    .replaceAll("{{max_words}}", String(cfg.answer.max_words))
    .replaceAll("{{question}}", question)
    .replaceAll("{{sources}}", sources);
}

function bareUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

/** Citation label: 'PSI-98 · doi:10.60555/...' or 'Apollo 1 · sma.nasa.gov/...'. */
export function label(meta: Chunk): string {
  if (meta.field.startsWith("comparison")) return `${meta.title} · DOIs per row`;
  if (meta.field === "coverage") return `${meta.title} · ${bareUrl(meta.url)}`;
  if (meta.source_type === "psi") return `${meta.psi_id} · doi:${meta.doi}`;
  return `${meta.title} · ${bareUrl(meta.url ?? "").replace(/\/+$/, "")}`;
}

export function citation(meta: Chunk): RawCitation {
  const out: RawCitation = { label: label(meta), source_type: meta.source_type, url: meta.url };
  if (meta.source_type === "psi") Object.assign(out, { psi_id: meta.psi_id, doi: meta.doi, acronym: meta.acronym });
  else out.title = meta.title;
  return out;
}

export function formatSources(hits: Hit[]): string {
  return hits
    .map((hit, i) => {
      const m = hit.meta;
      const origin =
        m.source_type === "psi" ? `PSI · ${m.psi_id} ${m.acronym ?? ""} · ${m.field}` : `NASA resource · ${m.title}`;
      return `[S${i + 1}] (${origin})\n${hit.text}`;
    })
    .join("\n\n");
}

/** '$\\text{CO}_2$' -> 'CO2': the site shows plain text. */
export function stripLatex(text: string): string {
  return text.replace(/\$([^$\n]{0,40}[\\_^][^$\n]{0,40})\$/g, (_, inner: string) =>
    inner
      .replace(/\\(?:text|mathrm)\{([^}]*)\}/g, "$1")
      .replace(/[_^]\{?([^}\s]*)\}?/g, "$1")
      .replaceAll("\\", ""),
  );
}

/** Replace [S#] markers with source labels; drop markers for sources that don't exist. */
export function applyCitations(text: string, hits: Hit[]): { text: string; used: RawCitation[] } {
  const used: RawCitation[] = [];
  let cleaned = stripLatex(text).replace(CITE, (_, group: string) => {
    const labels: string[] = [];
    for (const num of group.match(/\d+/g) ?? []) {
      const i = Number(num);
      if (i >= 1 && i <= hits.length) {
        const cite = citation(hits[i - 1].meta);
        if (!used.some((c) => c.label === cite.label)) used.push(cite);
        if (!labels.includes(cite.label)) labels.push(cite.label);
      }
    }
    return labels.map((l) => `[${l}]`).join("");
  });
  cleaned = cleaned.replace(/(\[[^[\]]+\])(?:\s*\1)+/g, "$1");
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,;:])/g, "$1").trim();
  return { text: cleaned, used };
}

function passages(question: string, hits: Hit[], cfg: RagConfig): RawAnswer {
  const top = hits.slice(0, cfg.answer.fallback_passages);
  const limit = cfg.answer.fallback_passage_chars;
  const lines = [cfg.answer.offline_note, ""];
  for (const hit of top) {
    const text = hit.text.length <= limit ? hit.text : `${hit.text.slice(0, limit).replace(/ [^ ]*$/, "")} …`;
    lines.push(`[${label(hit.meta)}] ${text}`, "");
  }
  return { question, answer: lines.join("\n").trim(), citations: top.map((h) => citation(h.meta)), covered: true, mode: "passages" };
}

function notCovered(question: string, cfg: RagConfig): RawAnswer {
  return { question, answer: cfg.answer.not_covered_text, citations: [], covered: false, mode: "not_covered" };
}

/** Same decisions as rag.ask.answer(); returns Python-shaped citations (labels inline). */
export async function answerRaw(rawQuestion: string, deps: AnswerDeps): Promise<RawAnswer> {
  const { cfg, index } = deps;
  const question = rawQuestion.trim().slice(0, cfg.answer.max_question_chars);
  let hits: Hit[];
  try {
    hits = retrieve(index, question, await deps.embed(question), cfg);
  } catch {
    hits = keywordRetrieve(index, question, cfg); // query embedding unavailable -> keyword search, no LLM
    return hits.length ? passages(question, hits, cfg) : notCovered(question, cfg);
  }
  if (!hits.length || Math.max(...hits.map((h) => h.similarity ?? 0)) < cfg.retrieval.min_similarity) {
    return notCovered(question, cfg);
  }
  let reply: string;
  try {
    reply = await deps.generate(buildPrompt(deps.prompt, question, formatSources(hits), cfg));
  } catch {
    return passages(question, hits, cfg);
  }
  if (reply.includes(cfg.answer.not_covered_reply)) return notCovered(question, cfg);
  const { text, used } = applyCitations(reply, hits);
  if (!used.length) return notCovered(question, cfg);
  return { question, answer: text, citations: used, covered: true, mode: "llm" };
}

// --- presentation: numbered citations with links -----------------------------------------

export function citationHref(c: RawCitation): string {
  if (c.source_type === "psi") {
    return c.psi_id && /^PSI-\d+$/.test(c.psi_id) ? `/investigations/${c.psi_id}` : "/method#coverage";
  }
  return c.url ?? "/method#sources";
}

/** '[PSI-98 · doi:…]' inline labels -> '[1]' markers + numbered, linked citation list. */
export function numberCitations(raw: RawAnswer): AskResponse {
  const citations: Citation[] = raw.citations.map((c, i) => ({
    n: i + 1,
    label: c.label,
    href: citationHref(c),
    source_type: c.source_type,
  }));
  let answer = raw.answer;
  for (const c of citations) answer = answer.replaceAll(`[${c.label}]`, `[${c.n}]`);
  return { question: raw.question, answer, citations, covered: raw.covered, mode: raw.mode };
}

export async function answer(question: string, deps: AnswerDeps): Promise<AskResponse> {
  return numberCitations(await answerRaw(question, deps));
}
