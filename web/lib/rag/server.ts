// Server-only: loads the search index once per function instance and talks to Gemini.
// GEMINI_API_KEY is read here and nowhere else; it is never logged or sent to the client.
import "server-only";

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { DemoAnswer } from "../types";
import type { RagConfig } from "./config";
import { decodeVectors, normalizeQuery, tokens, type Chunk, type RagIndex } from "./retrieve";

const DATA_DIR = path.join(process.cwd(), "data");

function read(name: string): string {
  return fs.readFileSync(path.join(DATA_DIR, name), "utf-8");
}

let state: { cfg: RagConfig; prompt: string; index: RagIndex; demo: DemoAnswer[] } | null = null;

/** Index, shared config, prompt and demo answers - decoded once at first use. */
export function ragState() {
  if (!state) {
    const cfg = JSON.parse(read("rag_config.json")) as RagConfig;
    const raw = JSON.parse(read("rag_index.json")) as { model: string; dims: number; chunks: Chunk[]; vectors_b64: string };
    state = {
      cfg,
      prompt: read("rag_prompt.md").replace(/\r\n/g, "\n"),
      demo: JSON.parse(read("demo_answers.json")) as DemoAnswer[],
      index: {
        model: raw.model,
        dims: raw.dims,
        chunks: raw.chunks,
        vectors: decodeVectors(raw.vectors_b64, raw.dims),
        tokens: raw.chunks.map((c) => tokens(c.text, cfg)),
      },
    };
  }
  return state;
}

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

function retryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status ?? 0;
  return status === 429 || status >= 500;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!retryable(err)) throw err;
    await new Promise((r) => setTimeout(r, 2000));
    return fn();
  }
}

export async function embedQuery(question: string, cfg: RagConfig): Promise<Float32Array> {
  const response = await withRetry(() =>
    client().models.embedContent({
      model: cfg.embedding.model,
      contents: [question],
      config: { taskType: cfg.embedding.query_task_type, outputDimensionality: cfg.embedding.output_dimensionality },
    }),
  );
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("empty embedding");
  return normalizeQuery(values);
}

export async function generateAnswer(prompt: string, cfg: RagConfig): Promise<string> {
  const response = await withRetry(() =>
    client().models.generateContent({ model: process.env.GEMINI_MODEL || cfg.answer_model_default, contents: prompt }),
  );
  return response.text ?? "";
}
