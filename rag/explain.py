"""Explain a ranking in plain English. The rubric decides; the LLM only explains.

explain_ranking(results, scenario_key, focus) takes rank.rank() output, uses ONLY the top 3
results' breakdown reasons and notes, and returns 2-3 sentences citing PSI IDs. If Gemini is
unavailable, or its text contains a number that isn't in those reasons or reorders the ranking,
the same explanation is built from the reason strings without the LLM.
"""
from __future__ import annotations

import re
from typing import Callable

from rank import config as rank_config

PROMPT = """Explain in 2-3 plain-English sentences why these three NASA investigations rank highest
for the scenario "{scenario}" (focus: {focus}). Use ONLY the facts below. Do not reorder them,
do not change any score, do not add facts. Mention each investigation with its PSI ID in square
brackets, e.g. [PSI-98], in rank order.

{facts}
"""
# Opt-in for combos whose free wording drifted (e.g. calling a mismatch "ventilated airflow scores").
STRICT_RULE = ("\nStrict wording: use only the wording and numbers in the reasons above. Do not describe "
               "a criterion in your own words; quote or closely paraphrase its reason.\n")


def _top3_facts(results: list[dict]) -> str:
    blocks = []
    for i, r in enumerate(results[:3], 1):
        lines = [f"#{i} [{r['psi_id']}] {r['acronym']} — total {r['total']}/100"]
        lines += [f"  - {b['criterion']}: {b['reason']}" for b in r["breakdown"]]
        lines += [f"  - note: {n}" for n in r.get("notes", [])]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _numbers(text: str) -> set[str]:
    return {f"{float(n):g}" for n in re.findall(r"\d+(?:\.\d+)?", text)}  # "20.0" == "20"


def is_faithful(text: str, results: list[dict]) -> bool:
    """Every number comes from the facts, and the top 3 PSI IDs appear in rank order."""
    facts = _top3_facts(results)
    if not _numbers(text) <= _numbers(facts):
        return False
    ids = [r["psi_id"] for r in results[:3]]
    positions = [text.find(f"[{pid}]") for pid in ids]
    return all(p >= 0 for p in positions) and positions == sorted(positions)


def offline_explanation(results: list[dict], scenario_key: str, focus: str) -> str:
    """Template explanation from the reason strings only (no LLM)."""
    scenario = rank_config.SCENARIOS[scenario_key]["label"]
    sentences = []
    for i, r in enumerate(results[:3], 1):
        best = sorted(r["breakdown"], key=lambda b: b["points"] / b["max"], reverse=True)[:2]
        why = "; ".join(b["reason"] for b in best)
        lead = f"For {scenario} (focus: {focus}), " if i == 1 else ""
        sentences.append(f"{lead}#{i} {r['acronym']} [{r['psi_id']}] scores {r['total']}/100 — {why}.")
    return " ".join(sentences)


def explain_ranking_detailed(results: list[dict], scenario_key: str, focus: str,
                             generator: Callable[[str], str] | None = None,
                             strict: bool = False) -> tuple[str, str]:
    """(explanation, mode) with mode "llm" or "offline"."""
    if not results:
        return "No investigations to rank.", "offline"
    scenario = rank_config.SCENARIOS[scenario_key]["label"]
    try:
        if generator is None:
            from rag.ask import gemini_generate as generator
        prompt = PROMPT.format(scenario=scenario, focus=focus, facts=_top3_facts(results))
        text = generator(prompt + (STRICT_RULE if strict else "")).strip()
        if text and is_faithful(text, results):
            return text, "llm"
        print(f"  explanation for {scenario_key}/{focus} not faithful to the rubric - using offline text")
    except Exception as exc:
        print(f"  Gemini unavailable ({type(exc).__name__}) - offline explanation")
    return offline_explanation(results, scenario_key, focus), "offline"


def explain_ranking(results: list[dict], scenario_key: str, focus: str,
                    generator: Callable[[str], str] | None = None) -> str:
    return explain_ranking_detailed(results, scenario_key, focus, generator)[0]


DEMO_RANKINGS = [("moon_base", "all"), ("iss_cabin", "all"), ("spacesuit", "all"), ("moon_base", "detection")]


def demo_explanations(generator: Callable[[str], str] | None = None) -> dict:
    from rank.score import load_inputs, rank

    records, placeholders = load_inputs()
    out = {}
    for scenario_key, focus in DEMO_RANKINGS:
        results = rank(records, scenario_key, focus, placeholders=placeholders)
        text, mode = explain_ranking_detailed(results, scenario_key, focus, generator)
        out[f"{scenario_key}/{focus}"] = {
            "scenario": scenario_key, "focus": focus, "explanation": text, "mode": mode,
            "top3": [{"psi_id": r["psi_id"], "acronym": r["acronym"], "total": r["total"]} for r in results[:3]],
        }
    return out
