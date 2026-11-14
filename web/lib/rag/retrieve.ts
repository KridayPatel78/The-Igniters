// Hybrid retrieval - a 1:1 port of rag/ask.py (tokens, expand, bm25_scores, cosine, fuse).
// Determinism rules shared with Python: query terms de-duplicated and sorted; sums run in index
// order; ties always break on the lower chunk index. tests/parity.test.ts proves the website
// retrieves exactly the chunks Python retrieves (data/rag_eval.json).

import type { RagConfig } from "./config";

export interface Chunk {
  id: string;
  text: string;
  source_type: "psi" | "resource";
  psi_id?: string;
  acronym?: string;
  doi?: string;
  resource_id?: string;
  title: string;
  url: string;
  field: string;
}

export interface RagIndex {
  model: string;
  dims: number;
  chunks: Chunk[];
  vectors: Float32Array[];
  tokens: string[][];
}

export interface Hit {
  id: string;
  text: string;
  meta: Chunk;
  similarity: number | null;
}

export function decodeVectors(b64: string, dims: number): Float32Array[] {
  const bytes = Buffer.from(b64, "base64");
  // Copy into an aligned buffer (Buffer slices may not be 4-byte aligned); data is little-endian.
  const all = new Float32Array(bytes.byteLength / 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < all.length; i++) all[i] = view.getFloat32(i * 4, true);
  const vectors: Float32Array[] = [];
  for (let start = 0; start < all.length; start += dims) vectors.push(all.subarray(start, start + dims));
  return vectors;
}

export function tokens(text: string, cfg: RagConfig): string[] {
  const r = cfg.retrieval;
  const stop = new Set(r.stopwords);
  const found = text.toLowerCase().match(new RegExp(r.token_pattern, "g")) ?? [];
  return found.filter((t) => !stop.has(t) && t.length >= r.min_token_length);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Question tokens plus fire-safety synonyms (rag_config.json) for keyword search. */
export function expand(question: string, cfg: RagConfig): string[] {
  const lowered = question.toLowerCase();
  const extra = Object.entries(cfg.retrieval.synonyms)
    .filter(([k]) => new RegExp(`\\b${escapeRegExp(k)}\\b`).test(lowered))
    .map(([, v]) => v)
    .join(" ");
  return tokens(`${question} ${extra}`, cfg);
}

function count(doc: string[], term: string): number {
  let n = 0;
  for (const t of doc) if (t === term) n++;
  return n;
}

export function bm25Scores(query: string[], docs: string[][], cfg: RagConfig): number[] {
  const { k1, b } = cfg.retrieval.bm25;
  const terms = [...new Set(query)].sort();
  const n = docs.length;
  let totalLength = 0;
  for (const d of docs) totalLength += d.length;
  const avg = totalLength / Math.max(n, 1);
  const df = new Map<string, number>();
  for (const t of terms) {
    let c = 0;
    for (const d of docs) if (d.includes(t)) c++;
    df.set(t, c);
  }
  return docs.map((doc) => {
    let score = 0;
    for (const t of terms) {
      const tf = count(doc, t);
      if (tf) {
        const d = df.get(t) as number;
        const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5));
        score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / avg));
      }
    }
    return score;
  });
}

/** Dot products of unit vectors, summed left to right in double precision (as in Python). */
export function cosine(query: ArrayLike<number>, vectors: Float32Array[]): number[] {
  return vectors.map((v) => {
    let total = 0;
    for (let i = 0; i < v.length; i++) total += query[i] * v[i];
    return total;
  });
}

export function sourceKey(meta: Chunk): string {
  if (meta.source_type === "psi") return meta.psi_id ?? "";
  return meta.resource_id || meta.title || "";
}

function order(scores: number[]): number[] {
  return scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
}

/** Reciprocal-rank fusion of the two rankings, at most max_per_source chunks per document. */
export function fuse(similarities: number[], keyword: number[], k: number, metas: Chunk[], cfg: RagConfig): number[] {
  const r = cfg.retrieval;
  const rrf = new Array<number>(keyword.length).fill(0);
  for (const scores of [similarities, keyword]) {
    order(scores)
      .slice(0, r.fusion_depth)
      .forEach((i, rank) => {
        if (scores[i] > 0) rrf[i] += 1 / (r.rrf_k + rank + 1);
      });
  }
  const tiebreak = similarities.length ? similarities : new Array<number>(keyword.length).fill(0);
  const sorted = rrf.map((_, i) => i).sort((a, b) => rrf[b] - rrf[a] || tiebreak[b] - tiebreak[a] || a - b);
  const picked: number[] = [];
  const perSource = new Map<string, number>();
  for (const i of sorted) {
    if (rrf[i] === 0 || picked.length === k) break;
    const key = sourceKey(metas[i]);
    const used = perSource.get(key) ?? 0;
    if (used < r.max_per_source) {
      picked.push(i);
      perSource.set(key, used + 1);
    }
  }
  return picked;
}

/** Python's round(x, 4) for display / threshold checks. */
export function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

function hits(index: RagIndex, picked: number[], sims: number[] | null): Hit[] {
  return picked.map((i) => ({
    id: index.chunks[i].id,
    text: index.chunks[i].text,
    meta: index.chunks[i],
    similarity: sims ? round4(sims[i]) : null,
  }));
}

/** Hybrid top-k chunks for a question whose normalized query vector is known. */
export function retrieve(index: RagIndex, question: string, queryVector: ArrayLike<number>, cfg: RagConfig, k = cfg.retrieval.k): Hit[] {
  const sims = cosine(queryVector, index.vectors);
  const keyword = bm25Scores(expand(question, cfg), index.tokens, cfg);
  return hits(index, fuse(sims, keyword, k, index.chunks, cfg), sims);
}

/** Keyword-only fallback when the embedding API is unreachable. */
export function keywordRetrieve(index: RagIndex, question: string, cfg: RagConfig, k = cfg.retrieval.k): Hit[] {
  const keyword = bm25Scores(expand(question, cfg), index.tokens, cfg);
  return hits(index, fuse([], keyword, k, index.chunks, cfg), null);
}

/** L2-normalize and round to float32, exactly like rag/embeddings.py. */
export function normalizeQuery(values: number[]): Float32Array {
  let norm = 0;
  for (const v of values) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Float32Array.from(values, (v) => v / norm);
}
