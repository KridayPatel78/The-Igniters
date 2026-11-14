// Offline tests for the /api/ask logic (no network, no key): parity with Python retrieval,
// citation mapping, NOT_COVERED, threshold gate, fallbacks.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { answer, answerRaw, applyCitations, buildPrompt, numberCitations, stripLatex, type AnswerDeps } from "@/lib/rag/answer";
import { mentionsKnownGap, type RagConfig } from "@/lib/rag/config";
import { decodeVectors, expand, retrieve, tokens, type Chunk, type Hit, type RagIndex } from "@/lib/rag/retrieve";
import { ragState } from "@/lib/rag/server";

const DATA = path.join(__dirname, "..", "data");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(DATA, name), "utf-8"));
const { cfg, index, prompt } = ragState();

interface Fixture {
  dims: number;
  k: number;
  min_similarity: number;
  questions: { id: number; question: string; query_vector_b64: string; retrieved_ids: string[]; similarities: number[]; mode: string }[];
}
const fixture = read("rag_eval.json") as Fixture;

describe("parity with Python (rag_eval.json)", () => {
  it("has the 8 demo questions and the same settings", () => {
    expect(fixture.questions).toHaveLength(8);
    expect(fixture.k).toBe(cfg.retrieval.k);
    expect(fixture.min_similarity).toBe(cfg.retrieval.min_similarity);
    expect(index.vectors).toHaveLength(index.chunks.length);
    expect(index.vectors[0]).toHaveLength(768);
  });

  for (const q of fixture.questions) {
    it(`retrieves the same chunks in the same order: ${q.question}`, () => {
      const vector = decodeVectors(q.query_vector_b64, fixture.dims)[0];
      const hits = retrieve(index, q.question, vector, cfg, fixture.k);
      expect(hits.map((h) => h.id)).toEqual(q.retrieved_ids);
      expect(hits.map((h) => h.similarity)).toEqual(q.similarities);
    });
  }

  it("pizza stays below the threshold", () => {
    const pizza = fixture.questions.find((q) => q.question.includes("pizza"))!;
    expect(pizza.mode).toBe("not_covered");
    expect(Math.max(...pizza.similarities)).toBeLessThan(cfg.retrieval.min_similarity);
  });
});

describe("tokenizer and synonyms (shared rag_config.json)", () => {
  it("drops stopwords and short tokens, lowercases", () => {
    expect(tokens("What is the O2 of FLEX-2 a b?", cfg)).toEqual(["o2", "flex"]);
  });
  it("expands fire-safety synonyms", () => {
    expect(expand("What gases put out flames?", cfg)).toEqual(expect.arrayContaining(["suppressant", "extinguish"]));
  });
});

// --- answer flow with mocks ----------------------------------------------------------------

const PSI: Chunk = { id: "psi:PSI-98:objective:0", text: "Saffire fire growth text", source_type: "psi", psi_id: "PSI-98", acronym: "SAFFIRE-I", doi: "10.60555/0t15-1z43", title: "Saffire", url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98", field: "objective" };
const RES: Chunk = { id: "res:apollo-1:0", text: "Apollo 1 cabin fire text", source_type: "resource", resource_id: "apollo-1", title: "Apollo 1", url: "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1", field: "resource" };
const hits = (...sims: number[]): Hit[] => sims.map((s, i) => ({ id: `h${i}`, text: `passage ${i} ` + "word ".repeat(150), meta: i % 2 ? RES : PSI, similarity: s }));

describe("citations", () => {
  it("maps valid markers, drops unknown [S9], dedupes", () => {
    const { text, used } = applyCitations("Fire grows [S1]. Apollo burned [S2][S2]. Bogus [S9].", hits(0.9, 0.8));
    expect(text).toContain("[PSI-98 · doi:10.60555/0t15-1z43]");
    expect(text).toContain("[Apollo 1 · sma.nasa.gov/sma-disciplines/accllp/apollo-1]");
    expect(text).not.toMatch(/S9|S1|S2/);
    expect(used.map((c) => c.label)).toEqual(["PSI-98 · doi:10.60555/0t15-1z43", "Apollo 1 · sma.nasa.gov/sma-disciplines/accllp/apollo-1"]);
  });
  it("numbers citations and links PSI to detail pages, resources to their URL", () => {
    const { used, text } = applyCitations("A [S1]. B [S2].", hits(0.9, 0.8));
    const out = numberCitations({ question: "q", answer: text, citations: used, covered: true, mode: "llm" });
    expect(out.answer).toBe("A [1]. B [2].");
    expect(out.citations).toEqual([
      { n: 1, label: "PSI-98 · doi:10.60555/0t15-1z43", href: "/investigations/PSI-98", source_type: "psi" },
      { n: 2, label: "Apollo 1 · sma.nasa.gov/sma-disciplines/accllp/apollo-1", href: "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1", source_type: "resource" },
    ]);
  });
  it("strips LaTeX but not prices", () => {
    expect(stripLatex("($\\text{CO}_2$) and $5 or $10")).toBe("(CO2) and $5 or $10");
  });
  it("fills the shared prompt", () => {
    const p = buildPrompt(prompt, "Why?", "[S1] (PSI) x", cfg);
    expect(p).toContain("QUESTION: Why?");
    expect(p).not.toContain("{{");
    expect(p).toContain("planned");
  });
});

function deps(over: Partial<AnswerDeps> & { hitsOverride?: Hit[] } = {}): AnswerDeps {
  const small: RagIndex = {
    model: "m",
    dims: 2,
    chunks: [PSI, RES],
    vectors: [Float32Array.from([1, 0]), Float32Array.from([0, 1])],
    tokens: [tokens(PSI.text, cfg), tokens(RES.text, cfg)],
  };
  return {
    cfg,
    prompt,
    index: small,
    embed: async () => [1, 0],
    generate: async () => "Fire grows [S1].",
    ...over,
  };
}

describe("answer flow", () => {
  it("llm mode with only used citations", async () => {
    const out = await answer("How does Saffire fire grow?", deps());
    expect(out.mode).toBe("llm");
    expect(out.citations.map((c) => c.label)).toEqual(["PSI-98 · doi:10.60555/0t15-1z43"]);
  });
  it("NOT_COVERED reply -> not_covered", async () => {
    const out = await answer("q", deps({ generate: async () => "NOT_COVERED" }));
    expect(out).toEqual({ question: "q", answer: cfg.answer.not_covered_text, citations: [], covered: false, mode: "not_covered" });
  });
  it("no valid citation -> not_covered", async () => {
    expect((await answer("q", deps({ generate: async () => "Uncited [S7]." }))).mode).toBe("not_covered");
  });
  it("below threshold -> not_covered and Gemini is never called", async () => {
    const generate = vi.fn(async () => "x [S1].");
    const lowCfg: RagConfig = { ...cfg, retrieval: { ...cfg.retrieval, min_similarity: 0.99 } };
    const out = await answer("q", deps({ cfg: lowCfg, embed: async () => [0.5, 0.5], generate }));
    expect(out.mode).toBe("not_covered");
    expect(generate).not.toHaveBeenCalled();
  });
  it("answer call fails -> passages (top 3 with citations)", async () => {
    const out = await answer("Saffire fire", deps({ generate: async () => { throw new Error("503"); } }));
    expect(out.mode).toBe("passages");
    expect(out.answer.startsWith(cfg.answer.offline_note)).toBe(true);
    expect(out.citations.length).toBeGreaterThan(0);
  });
  it("embedding call fails -> keyword-only passages, no LLM", async () => {
    const generate = vi.fn(async () => "x");
    const real = { ...deps(), index, embed: async () => { throw new Error("offline"); }, generate };
    const out = await answer("What gases put out flames in FLEX?", real);
    expect(out.mode).toBe("passages");
    expect(out.citations).toHaveLength(3);
    expect(out.citations.some((c) => c.href === "/investigations/PSI-69")).toBe(true);
    expect(generate).not.toHaveBeenCalled();
  });
  it("trims long questions to max_question_chars", async () => {
    const out = await answerRaw("x".repeat(1000), deps());
    expect(out.question).toHaveLength(cfg.answer.max_question_chars);
  });
});

describe("known gaps trigger", () => {
  it.each([
    ["Is there fire data for Moon gravity?", true],
    ["What about Martian habitats?", true],
    ["Reduced gravity flame spread", true],
    ["How was smoke detection tested?", false],
  ])("%s -> %s", (q, expected) => {
    expect(mentionsKnownGap(q, cfg)).toBe(expected);
  });
});
