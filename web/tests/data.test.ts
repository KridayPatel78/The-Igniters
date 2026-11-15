import { describe, expect, it } from "vitest";
import { getCardFacts, getDemoAnswers, getExplanations, getExplorer, getInvestigations, getRanking, getScenarios, getSources, rankingKeys, toLite } from "@/lib/data";
import { displayName, NOT_REPORTED } from "@/lib/format";
import { parseAskBody, RateLimiter } from "@/lib/rateLimit";

describe("data loaders", () => {
  it("24 investigations matching the contract enums", () => {
    const records = getInvestigations();
    expect(records).toHaveLength(24);
    for (const r of records) {
      expect(r.psi_id).toMatch(/^PSI-\d+$/);
      expect(["solid", "liquid_droplet", "gas", "mixed"]).toContain(r.fuel_phase);
      expect(r.source_urls.length).toBeGreaterThan(0);
    }
  });

  it("24 rankings, each with all 24 IDs and an explanation", () => {
    const keys = rankingKeys();
    const ids = new Set(getInvestigations().map((r) => r.psi_id));
    const explanations = getExplanations();
    expect(keys).toHaveLength(24);
    for (const key of keys) {
      const ranking = getRanking(key);
      expect(new Set(ranking.results.map((r) => r.psi_id))).toEqual(ids);
      expect(ranking.results.every((r) => r.breakdown.length === 5 && r.breakdown.every((b) => b.reason))).toBe(true);
      expect(explanations[key]?.explanation).toBeTruthy();
    }
  });

  it("scenarios, sources, demo answers", () => {
    expect(getScenarios().scenarios.map((s) => s.key)).toEqual(["iss_cabin", "moon_base", "spacesuit"]);
    expect(getSources()).toHaveLength(10);
    expect(getDemoAnswers()).toHaveLength(8);
  });

  it("lite records drop test rows but keep counts", () => {
    const lite = toLite(getInvestigations().find((r) => r.psi_id === "PSI-10")!);
    expect("tests" in lite).toBe(false);
    expect(lite.test_count).toBeGreaterThan(100);
    expect(lite.test_tables).toHaveLength(2);
  });
});

describe("dashboard data", () => {
  it("explorer has one row per NASA test row, values only where a column exists", () => {
    const { rows, tables } = getExplorer();
    expect(rows).toHaveLength(getInvestigations().reduce((n, r) => n + r.tests.length, 0));
    for (const r of rows) {
      const t = tables[r.table];
      expect(t.psi_id).toBe(r.psi_id);
      for (const k of ["o2", "pressure", "airflow"] as const) {
        if (r[k]) {
          expect(t.columns[k]).toBeTruthy();
          expect(r[k]![0]).toBeLessThanOrEqual(r[k]![1]);
        }
      }
    }
  });

  it("every investigation gets a readable name (no 'not reported' labels)", () => {
    for (const r of getInvestigations()) expect(displayName(r.acronym, r.psi_id)).not.toBe(NOT_REPORTED);
    expect(Object.values(getCardFacts()).every((f) => f.name && f.name !== NOT_REPORTED)).toBe(true);
  });
});

describe("input validation", () => {
  it("accepts a normal question", () => {
    expect(parseAskBody('{"question":"  Why?  "}', 300)).toEqual({ ok: true, question: "Why?" });
  });
  it.each([
    ["not json", 400],
    ['{"question":""}', 400],
    ['{"question":42}', 400],
    [JSON.stringify({ question: "x".repeat(301) }), 400],
    [JSON.stringify({ question: "x".repeat(3000) }), 413],
  ])("rejects %#", (body, status) => {
    const out = parseAskBody(body, 300);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(status);
  });
});

describe("rate limiter", () => {
  it("allows 10 per minute per IP, then blocks, then recovers", () => {
    const rl = new RateLimiter(10, 60_000);
    for (let i = 0; i < 10; i++) expect(rl.allow("1.2.3.4", 1000 + i)).toBe(true);
    expect(rl.allow("1.2.3.4", 2000)).toBe(false);
    expect(rl.allow("5.6.7.8", 2000)).toBe(true);
    expect(rl.allow("1.2.3.4", 62_000)).toBe(true);
  });
});
