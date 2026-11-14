"""The AI librarian: answer a question only from our NASA sources, citing every claim.

Usage:
    python -m rag.ask "How does fire spread on fabric in microgravity?"
    python -m rag.ask --demo     # rag/demo_questions.json -> data/processed/demo_answers.json
                                 # + ranking explanations -> data/processed/demo_explanations.json

answer() modes:
  "llm"          Gemini answer; every [S#] marker mapped to a real source label
  "passages"     Gemini unavailable (no key / network / API error) -> top 3 cited passages
  "not_covered"  sources don't cover it (low similarity, NOT_COVERED, or no valid citation)
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import time
from typing import Callable

from rag import config

CITE = re.compile(r"\[(S\d+(?:\s*[,;]\s*S?\d+)*)\]")

PROMPT = """You are a NASA fire-safety research librarian. Answer the QUESTION using ONLY the numbered
SOURCES below. Rules:
- Use only facts stated in the sources. Do not add outside knowledge.
- Put the source marker(s), e.g. [S2] or [S1][S4], after EVERY sentence that states a fact.
- Numbers about experiments (oxygen %, pressure, airflow, sizes, test counts) may only come from
  sources marked "PSI". Other sources can give history, context and Earth uses.
- If the sources cover only part of the question, answer that part and say plainly which part
  our sources do not cover.
- If the sources contain nothing relevant to the question, reply with exactly: NOT_COVERED
- Plain English for students and engineers, plain text only (no LaTeX). At most {max_words} words.

QUESTION: {question}

SOURCES:
{sources}
"""

STOPWORDS = set("""a an and are as at be by did do does for from how in into is it its of on or that the
their them they this to was were what when where which who why with any there about our""".split())


# --- retrieval (hybrid: embeddings + BM25 keywords, fused by rank) -----------------------------

def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS and len(t) > 1]


def expand(question: str) -> list[str]:
    """Question tokens plus fire-safety synonyms (rag/config.py SYNONYMS) for keyword search."""
    lowered = question.lower()
    extra = " ".join(v for k, v in config.SYNONYMS.items()
                     if re.search(r"\b" + re.escape(k) + r"\b", lowered))
    return tokens(f"{question} {extra}")


def bm25_scores(query: list[str], docs: list[list[str]], k1: float = 1.5, b: float = 0.75) -> list[float]:
    n = len(docs)
    avg = sum(map(len, docs)) / max(n, 1)
    df = {t: sum(1 for d in docs if t in d) for t in set(query)}
    scores = []
    for doc in docs:
        tf = {t: doc.count(t) for t in set(query)}
        score = 0.0
        for t in set(query):
            if tf[t]:
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                score += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * len(doc) / avg))
        scores.append(score)
    return scores


def source_key(meta: dict) -> str:
    """One 'document' for the per-source cap: a PSI investigation or a resource page."""
    return meta.get("psi_id") if meta.get("source_type") == "psi" else meta.get("id", meta.get("title", ""))


def fuse(similarities: list[float], keyword: list[float], k: int, metas: list[dict]) -> list[int]:
    """Reciprocal-rank fusion of the two rankings, at most MAX_PER_SOURCE chunks per document."""
    rrf = [0.0] * len(similarities)
    for scores in (similarities, keyword):
        order = sorted(range(len(scores)), key=lambda i: -scores[i])[:config.FUSION_DEPTH]
        for rank, i in enumerate(order):
            if scores[i] > 0:
                rrf[i] += 1 / (config.RRF_K + rank + 1)
    picked, per_source = [], {}
    for i in sorted(range(len(rrf)), key=lambda i: (-rrf[i], -similarities[i])):
        if rrf[i] == 0 or len(picked) == k:
            break
        key = source_key(metas[i])
        if per_source.get(key, 0) < config.MAX_PER_SOURCE:
            picked.append(i)
            per_source[key] = per_source.get(key, 0) + 1
    return picked


_CORPUS = None


def _corpus():
    """All chunks + normalized embeddings + tokens, loaded once from Chroma."""
    global _CORPUS
    if _CORPUS is None:
        from rag.build_index import get_collection

        data = get_collection().get(include=["documents", "metadatas", "embeddings"])
        _CORPUS = (data["documents"], data["metadatas"], [list(map(float, e)) for e in data["embeddings"]],
                   [tokens(t) for t in data["documents"]])
    return _CORPUS


def retrieve(question: str, k: int = 8) -> list[dict]:
    """Top-k chunks as {text, meta, similarity}; similarity = cosine of the question embedding."""
    from rag.build_index import embed

    texts, metas, vectors, doc_tokens = _corpus()
    q = embed([question])[0]
    sims = [sum(a * b for a, b in zip(q, v)) for v in vectors]
    picked = fuse(sims, bm25_scores(expand(question), doc_tokens), k, metas)
    return [{"text": texts[i], "meta": metas[i], "similarity": round(sims[i], 4)} for i in picked]


def label(meta: dict) -> str:
    """Citation label: 'PSI-98 · doi:10.60555/...' or 'Apollo 1 · sma.nasa.gov/...'."""
    if meta.get("field", "").startswith("comparison"):
        return f"{meta['title']} · DOIs per row"
    if meta.get("source_type") == "psi":
        return f"{meta['psi_id']} · doi:{meta['doi']}"
    return f"{meta['title']} · {re.sub(r'^https?://(www\.)?', '', meta.get('url', '')).rstrip('/')}"


def citation(meta: dict) -> dict:
    out = {"label": label(meta), "source_type": meta.get("source_type"), "url": meta.get("url")}
    if meta.get("source_type") == "psi":
        out.update(psi_id=meta["psi_id"], doi=meta["doi"], acronym=meta.get("acronym"))
    else:
        out.update(title=meta.get("title"))
    return out


def format_sources(hits: list[dict]) -> str:
    blocks = []
    for i, hit in enumerate(hits, 1):
        m = hit["meta"]
        origin = (f"PSI · {m['psi_id']} {m.get('acronym', '')} · {m.get('field')}" if m.get("source_type") == "psi"
                  else f"NASA resource · {m.get('title')}")
        blocks.append(f"[S{i}] ({origin})\n{hit['text']}")
    return "\n\n".join(blocks)


# --- generation ------------------------------------------------------------------------------

def gemini_generate(prompt: str) -> str:
    """One Gemini call (key from .env, never logged). Raises on any failure."""
    from dotenv import load_dotenv
    from google import genai
    from google.genai import errors

    load_dotenv(config.ROOT / ".env")
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    client = genai.Client(api_key=key)
    model = os.environ.get("GEMINI_MODEL") or config.DEFAULT_MODEL
    for attempt, wait in enumerate((0, 5, 15)):
        time.sleep(wait)
        try:
            return client.models.generate_content(model=model, contents=prompt).text or ""
        except errors.APIError as exc:
            if attempt == 2 or not (exc.code == 429 or (exc.code or 0) >= 500):
                raise
    raise RuntimeError("unreachable")


# --- answer checking -------------------------------------------------------------------------

def strip_latex(text: str) -> str:
    """'$\\text{CO}_2$' -> 'CO2': the app shows plain text."""
    def plain(match: re.Match) -> str:
        inner = re.sub(r"\\(?:text|mathrm)\{([^}]*)\}", r"\1", match.group(1))
        return re.sub(r"[_^]\{?([^}\s]*)\}?", r"\1", inner).replace("\\", "")
    return re.sub(r"\$([^$\n]{0,40}[\\_^][^$\n]{0,40})\$", plain, text)  # only real markup


def apply_citations(text: str, hits: list[dict]) -> tuple[str, list[dict]]:
    """Replace [S#] markers with source labels; drop markers for sources that don't exist.
    Returns (answer text, citations actually used, in order of first use)."""
    used: list[dict] = []

    def replace(match: re.Match) -> str:
        labels = []
        for num in re.findall(r"\d+", match.group(1)):
            i = int(num)
            if 1 <= i <= len(hits):
                cite = citation(hits[i - 1]["meta"])
                if cite["label"] not in [c["label"] for c in used]:
                    used.append(cite)
                if cite["label"] not in labels:
                    labels.append(cite["label"])
        return "".join(f"[{lab}]" for lab in labels)

    cleaned = CITE.sub(replace, strip_latex(text))
    cleaned = re.sub(r"(\[[^\[\]]+\])(?:\s*\1)+", r"\1", cleaned)  # [A][A] -> [A]
    cleaned = re.sub(r"[ \t]+([.,;:])", r"\1", re.sub(r"[ \t]{2,}", " ", cleaned)).strip()
    return cleaned, used


def _passages(question: str, hits: list[dict]) -> dict:
    top = hits[:config.FALLBACK_PASSAGES]
    lines = [config.OFFLINE_NOTE, ""]
    for hit in top:
        text = hit["text"] if len(hit["text"]) <= 500 else hit["text"][:500].rsplit(" ", 1)[0] + " …"
        lines.append(f"[{label(hit['meta'])}] {text}")
        lines.append("")
    return {"question": question, "answer": "\n".join(lines).strip(),
            "citations": [citation(h["meta"]) for h in top], "covered": True, "mode": "passages"}


def _not_covered(question: str) -> dict:
    return {"question": question, "answer": config.NOT_COVERED, "citations": [], "covered": False,
            "mode": "not_covered"}


def answer(question: str, k: int = 8, retriever: Callable | None = None,
           generator: Callable[[str], str] | None = None) -> dict:
    """{question, answer, citations, covered, mode}. retriever/generator are injectable for tests."""
    hits = (retriever or retrieve)(question, k)
    if not hits or max(h["similarity"] for h in hits) < config.MIN_SIMILARITY:
        return _not_covered(question)
    prompt = PROMPT.format(max_words=config.MAX_ANSWER_WORDS, question=question, sources=format_sources(hits))
    try:
        reply = (generator or gemini_generate)(prompt)
    except Exception as exc:  # no key, offline, API error -> still useful
        print(f"  Gemini unavailable ({type(exc).__name__}) - returning passages")
        return _passages(question, hits)
    if "NOT_COVERED" in reply:
        return _not_covered(question)
    text, used = apply_citations(reply, hits)
    if not used:
        return _not_covered(question)
    return {"question": question, "answer": text, "citations": used, "covered": True, "mode": "llm"}


# --- demo ------------------------------------------------------------------------------------

def checks(result: dict, hits: list[dict]) -> dict:
    """Review aids for the demo file: uncited sentences and numbers not found in any PSI chunk."""
    if result["mode"] != "llm":
        return {"uncited_sentences": [], "numbers_not_in_psi": []}
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z])", result["answer"]) if s.strip()]
    gap = re.compile(r"\b(do|does) not cover|not covered", re.I)  # stating a gap is not a claim
    uncited = [s for s in sentences if "[" not in s and len(s.split()) > 3 and not gap.search(s)]
    psi_text = " ".join(h["text"] for h in hits if h["meta"].get("source_type") == "psi")
    body = re.sub(r"\[[^\]]*\]", "", result["answer"])
    numbers = sorted({n for n in re.findall(r"\d+(?:\.\d+)?", body) if n not in psi_text})
    return {"uncited_sentences": uncited, "numbers_not_in_psi": numbers}


def run_demo() -> None:
    from rag.explain import demo_explanations

    questions = json.loads((config.ROOT / "rag" / "demo_questions.json").read_text(encoding="utf-8"))
    results = []
    for q in questions:
        hits = retrieve(q["question"])
        result = answer(q["question"], retriever=lambda *_: hits)
        result.update(id=q["id"], best_similarity=max((h["similarity"] for h in hits), default=0),
                      checks=checks(result, hits))
        results.append(result)
        print(f"\n[{q['id']}] {q['question']}\n  mode={result['mode']}  best_sim={result['best_similarity']}"
              f"\n  {result['answer']}\n  citations: {[c['label'] for c in result['citations']]}"
              f"\n  checks: {result['checks']}")
    out = config.PROCESSED_DIR / "demo_answers.json"
    out.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nSaved {out}")
    explanations = demo_explanations()
    out = config.PROCESSED_DIR / "demo_explanations.json"
    out.write_text(json.dumps(explanations, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for key, e in explanations.items():
        print(f"\n[{key}] mode={e['mode']}\n  {e['explanation']}")
    print(f"\nSaved {out}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("question", nargs="?")
    parser.add_argument("--demo", action="store_true", help="answer rag/demo_questions.json and save")
    args = parser.parse_args(argv)
    if args.demo:
        run_demo()
    elif args.question:
        result = answer(args.question)
        print(f"mode={result['mode']}\n{result['answer']}")
        for c in result["citations"]:
            print(f"  - {c['label']}")
    else:
        parser.error("give a question or --demo")


if __name__ == "__main__":
    main()
