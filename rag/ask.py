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


def build_prompt(question: str, sources: str) -> str:
    """rag/prompt.md with its {{placeholders}} filled (the website fills the same file)."""
    return (config.PROMPT_TEMPLATE.replace("{{max_words}}", str(config.MAX_ANSWER_WORDS))
            .replace("{{question}}", question).replace("{{sources}}", sources))


# --- retrieval (hybrid: embeddings + BM25 keywords, fused by rank) -----------------------------
# Every step below is mirrored 1:1 by the website (web/lib/retrieve.ts); rag_eval.json proves it.
# Determinism rules: query terms are de-duplicated and sorted; sums run in index order;
# ties always break on the lower chunk index.

def tokens(text: str) -> list[str]:
    return [t for t in re.findall(config.TOKEN_PATTERN, text.lower())
            if t not in config.STOPWORDS and len(t) >= config.MIN_TOKEN_LENGTH]


def expand(question: str) -> list[str]:
    """Question tokens plus fire-safety synonyms (rag/config.json) for keyword search."""
    lowered = question.lower()
    extra = " ".join(v for k, v in config.SYNONYMS.items()
                     if re.search(r"\b" + re.escape(k) + r"\b", lowered))
    return tokens(f"{question} {extra}")


def bm25_scores(query: list[str], docs: list[list[str]], k1: float = config.BM25_K1,
                b: float = config.BM25_B) -> list[float]:
    terms = sorted(set(query))
    n = len(docs)
    avg = sum(map(len, docs)) / max(n, 1)
    df = {t: sum(1 for d in docs if t in d) for t in terms}
    scores = []
    for doc in docs:
        score = 0.0
        for t in terms:
            tf = doc.count(t)
            if tf:
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                score += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * len(doc) / avg))
        scores.append(score)
    return scores


def source_key(meta: dict) -> str:
    """One 'document' for the per-source cap: a PSI investigation or a resource page."""
    if meta.get("source_type") == "psi":
        return meta.get("psi_id", "")
    return meta.get("resource_id") or meta.get("id") or meta.get("title", "")


def _order(scores: list[float]) -> list[int]:
    return sorted(range(len(scores)), key=lambda i: (-scores[i], i))


def fuse(similarities: list[float], keyword: list[float], k: int, metas: list[dict]) -> list[int]:
    """Reciprocal-rank fusion of the two rankings, at most MAX_PER_SOURCE chunks per document."""
    rrf = [0.0] * len(keyword)
    for scores in (similarities, keyword):
        for rank, i in enumerate(_order(scores)[:config.FUSION_DEPTH]):
            if scores[i] > 0:
                rrf[i] += 1 / (config.RRF_K + rank + 1)
    tiebreak = similarities if similarities else [0.0] * len(keyword)
    picked, per_source = [], {}
    for i in sorted(range(len(rrf)), key=lambda i: (-rrf[i], -tiebreak[i], i)):
        if rrf[i] == 0 or len(picked) == k:
            break
        key = source_key(metas[i])
        if per_source.get(key, 0) < config.MAX_PER_SOURCE:
            picked.append(i)
            per_source[key] = per_source.get(key, 0) + 1
    return picked


_INDEX = None


def load_index(path=None) -> dict:
    """rag_index.json -> {chunks, vectors (list of float lists, exact float32 values), tokens}."""
    global _INDEX
    if _INDEX is None or path is not None:
        from rag.embeddings import decode_b64

        data = json.loads((path or config.INDEX_FILE).read_text(encoding="utf-8"))
        index = {"chunks": data["chunks"], "vectors": decode_b64(data["vectors_b64"], data["dims"]).tolist(),
                 "tokens": [tokens(c["text"]) for c in data["chunks"]]}
        if path is not None:
            return index
        _INDEX = index
    return _INDEX


def cosine(query: list[float], vectors: list[list[float]]) -> list[float]:
    """Dot products of unit vectors, summed left to right in double precision (as in TypeScript)."""
    sims = []
    for v in vectors:
        total = 0.0
        for a, b in zip(query, v):
            total += a * b
        sims.append(total)
    return sims


def _hits(index: dict, picked: list[int], sims: list[float] | None) -> list[dict]:
    return [{"id": index["chunks"][i]["id"], "text": index["chunks"][i]["text"], "meta": index["chunks"][i],
             "similarity": round(sims[i], 4) if sims else None} for i in picked]


def retrieve(question: str, k: int = config.K, query_vector: list[float] | None = None) -> list[dict]:
    """Hybrid top-k chunks as {id, text, meta, similarity}. Raises if the query can't be embedded."""
    from rag.embeddings import embed_query

    index = load_index()
    q = query_vector if query_vector is not None else embed_query(question).tolist()
    sims = cosine(q, index["vectors"])
    return _hits(index, fuse(sims, bm25_scores(expand(question), index["tokens"]), k, index["chunks"]), sims)


def keyword_retrieve(question: str, k: int = config.K) -> list[dict]:
    """Keyword-only fallback when the embedding API is unreachable."""
    index = load_index()
    keyword = bm25_scores(expand(question), index["tokens"])
    return _hits(index, fuse([], keyword, k, index["chunks"]), None)


def label(meta: dict) -> str:
    """Citation label: 'PSI-98 · doi:10.60555/...' or 'Apollo 1 · sma.nasa.gov/...'."""
    if meta.get("field", "").startswith("comparison"):
        return f"{meta['title']} · DOIs per row"
    if meta.get("field") == "coverage":
        return f"{meta['title']} · {re.sub(r'^https?://(www\.)?', '', meta['url'])}"
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
    limit = config.FALLBACK_PASSAGE_CHARS
    lines = [config.OFFLINE_NOTE, ""]
    for hit in top:
        text = hit["text"] if len(hit["text"]) <= limit else hit["text"][:limit].rsplit(" ", 1)[0] + " …"
        lines.append(f"[{label(hit['meta'])}] {text}")
        lines.append("")
    return {"question": question, "answer": "\n".join(lines).strip(),
            "citations": [citation(h["meta"]) for h in top], "covered": True, "mode": "passages"}


def _not_covered(question: str) -> dict:
    return {"question": question, "answer": config.NOT_COVERED, "citations": [], "covered": False,
            "mode": "not_covered"}


def answer(question: str, k: int = config.K, retriever: Callable | None = None,
           generator: Callable[[str], str] | None = None) -> dict:
    """{question, answer, citations, covered, mode}. retriever/generator are injectable for tests."""
    question = question.strip()[:config.MAX_QUESTION_CHARS]
    try:
        hits = (retriever or retrieve)(question, k)
    except Exception as exc:  # query embedding unavailable -> keyword search, no LLM
        print(f"  embedding unavailable ({type(exc).__name__}) - keyword-only passages")
        hits = keyword_retrieve(question, k)
        return _passages(question, hits) if hits else _not_covered(question)
    if not hits or max(h["similarity"] for h in hits) < config.MIN_SIMILARITY:
        return _not_covered(question)
    prompt = build_prompt(question, format_sources(hits))
    try:
        reply = (generator or gemini_generate)(prompt)
    except Exception as exc:  # no key, offline, API error -> still useful
        print(f"  Gemini unavailable ({type(exc).__name__}) - returning passages")
        return _passages(question, hits)
    if config.NOT_COVERED_REPLY in reply:
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
    from rag.embeddings import embed_query, encode_b64
    from rag.explain import demo_explanations

    questions = json.loads((config.ROOT / "rag" / "demo_questions.json").read_text(encoding="utf-8"))
    results, parity = [], []
    for q in questions:
        vector = embed_query(q["question"])
        hits = retrieve(q["question"], query_vector=vector.tolist())
        result = answer(q["question"], retriever=lambda *_: hits)
        result.update(id=q["id"], best_similarity=max((h["similarity"] for h in hits), default=0),
                      checks=checks(result, hits))
        results.append(result)
        parity.append({"id": q["id"], "question": q["question"], "query_vector_b64": encode_b64(vector[None, :]),
                       "retrieved_ids": [h["id"] for h in hits],
                       "similarities": [h["similarity"] for h in hits], "mode": result["mode"]})
        print(f"\n[{q['id']}] {q['question']}\n  mode={result['mode']}  best_sim={result['best_similarity']}"
              f"\n  {result['answer']}\n  citations: {[c['label'] for c in result['citations']]}"
              f"\n  checks: {result['checks']}")
    _write(config.PROCESSED_DIR / "demo_answers.json", results)
    _write(config.EVAL_FILE, {"model": config.EMBEDDING_MODEL, "dims": config.EMBEDDING_DIMS, "k": config.K,
                              "min_similarity": config.MIN_SIMILARITY, "questions": parity})
    explanations = demo_explanations()
    _write(config.PROCESSED_DIR / "demo_explanations.json", explanations)
    for key, e in explanations.items():
        print(f"\n[{key}] mode={e['mode']}\n  {e['explanation']}")


def _write(path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {path.relative_to(config.ROOT)}")


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
