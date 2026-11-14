"""Offline tests for rag/ (no network, no embedding model, no API key). Run: pytest -q"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag import ask, build_index, config, explain, fetch_resources  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RECORDS = json.loads((ROOT / "data" / "processed" / "investigations.json").read_text(encoding="utf-8"))
BY_ID = {r["psi_id"]: r for r in RECORDS}

PSI_META = {"source_type": "psi", "psi_id": "PSI-98", "acronym": "SAFFIRE-I", "title": "Saffire",
            "doi": "10.60555/0t15-1z43", "field": "objective",
            "url": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98"}
RES_META = {"source_type": "resource", "id": "apollo-1", "title": "Apollo 1",
            "url": "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1"}


def hits(*sims):
    metas = [PSI_META, RES_META, {**PSI_META, "psi_id": "PSI-69", "doi": "10.60555/mbq8-0451"}]
    return [{"text": f"passage {i} " + "word " * 120, "meta": metas[i % 3], "similarity": s}
            for i, s in enumerate(sims)]


def must_not_call(prompt):
    raise AssertionError("Gemini must not be called")


# --- chunking --------------------------------------------------------------------------------

LONG = "\n\n".join(" ".join(f"para{p}word{w}" for w in range(60)) for p in range(12))


def test_chunks_respect_size_and_never_cut_words():
    chunks = build_index.chunk_text(LONG, size=400, overlap=60)
    words = set(LONG.split())
    assert len(chunks) > 3
    assert all(len(c) <= 400 for c in chunks)
    assert all(set(c.split()) <= words for c in chunks)  # every token is a whole original word


def test_chunks_overlap():
    chunks = build_index.chunk_text(LONG, size=400, overlap=60)
    for prev, nxt in zip(chunks, chunks[1:]):
        assert nxt.split()[0] in prev.split()[-12:]  # next chunk starts with the previous tail


def test_short_text_is_one_chunk_and_blank_is_none():
    assert build_index.chunk_text("Short paragraph.\n\nAnother one.") == ["Short paragraph.\n\nAnother one."]
    assert build_index.chunk_text("   ") == []


def test_documents_have_metadata():
    docs = build_index.psi_documents([BY_ID["PSI-98"]])
    assert docs and all(set(meta) >= {"source_type", "psi_id", "acronym", "title", "doi", "field", "url"}
                        for _, _, meta in docs)
    assert {meta["field"] for _, _, meta in docs} >= {"objective", "approach", "fact_card"}
    res = build_index.resource_documents()
    assert res and all(m["source_type"] == "resource" and m["title"] and m["url"].startswith("http")
                       for _, _, m in res)
    assert all(isinstance(v, (str, int, float, bool)) for _, _, m in docs + res for v in m.values())


# --- fact cards ------------------------------------------------------------------------------

def test_fact_card_values_and_not_reported():
    card = build_index.fact_card(BY_ID["PSI-98"])
    assert "Oxygen tested: 21.5–21.7 % O2" in card and "Airflow tested: 20 cm/s" in card
    assert "Pressure tested: not reported" in card and "10.60555/0t15-1z43" in card
    nothing = build_index.fact_card({**BY_ID["PSI-60"], "o2_percent_range": None, "fuels": [], "measurements": []})
    assert "Oxygen tested: not reported" in nothing and "Fuels: not reported" in nothing


def test_comparison_table_lists_every_investigation():
    table = build_index.comparison_table(RECORDS, "o2_percent_range", "oxygen", "% O2")
    assert all(r["psi_id"] in table for r in RECORDS)
    assert table.index("PSI-159") < table.index("PSI-98")  # highest first


# --- citations -------------------------------------------------------------------------------

def test_citation_mapping_drops_unknown_and_dedupes():
    text, used = ask.apply_citations("Fire grows fast [S1]. Apollo 1 burned [S2][S2]. Bogus [S9].", hits(0.6, 0.5))
    assert "[PSI-98 · doi:10.60555/0t15-1z43]" in text
    assert "[Apollo 1 · sma.nasa.gov/sma-disciplines/accllp/apollo-1]" in text
    assert "S9" not in text and "S1" not in text
    assert [c["label"] for c in used] == ["PSI-98 · doi:10.60555/0t15-1z43",
                                         "Apollo 1 · sma.nasa.gov/sma-disciplines/accllp/apollo-1"]
    assert used[0]["doi"] == "10.60555/0t15-1z43" and used[1]["url"].startswith("https://sma")


def test_grouped_markers():
    text, used = ask.apply_citations("Both say so [S1, S2].", hits(0.6, 0.5))
    assert len(used) == 2 and text.count("[") == 2


def test_answer_llm_mode_returns_only_used_citations():
    result = ask.answer("q", retriever=lambda q, k: hits(0.7, 0.6, 0.5), generator=lambda p: "A fact [S3].")
    assert result["mode"] == "llm" and result["covered"]
    assert [c["label"] for c in result["citations"]] == ["PSI-69 · doi:10.60555/mbq8-0451"]


def test_no_valid_citation_is_not_covered():
    result = ask.answer("q", retriever=lambda q, k: hits(0.7), generator=lambda p: "Uncited claim. Bad [S5].")
    assert result["mode"] == "not_covered" and result["answer"] == config.NOT_COVERED


def test_not_covered_reply():
    result = ask.answer("q", retriever=lambda q, k: hits(0.7), generator=lambda p: "NOT_COVERED")
    assert result == {"question": "q", "answer": config.NOT_COVERED, "citations": [], "covered": False,
                      "mode": "not_covered"}


def test_low_similarity_skips_gemini():
    low = config.MIN_SIMILARITY - 0.05
    result = ask.answer("best pizza?", retriever=lambda q, k: hits(low, low), generator=must_not_call)
    assert result["mode"] == "not_covered"


def test_gemini_error_falls_back_to_passages():
    def boom(prompt):
        raise ConnectionError("offline")
    result = ask.answer("q", retriever=lambda q, k: hits(0.7, 0.6, 0.5, 0.4), generator=boom)
    assert result["mode"] == "passages" and result["covered"]
    assert result["answer"].startswith(config.OFFLINE_NOTE)
    assert len(result["citations"]) == 3 and result["answer"].count("[PSI-98 · doi:") == 1


def test_prompt_numbers_sources_and_marks_psi():
    seen = {}
    ask.answer("q", retriever=lambda q, k: hits(0.7, 0.6), generator=lambda p: seen.setdefault("p", p) and "x [S1].")
    assert "[S1] (PSI · PSI-98" in seen["p"] and "[S2] (NASA resource · Apollo 1)" in seen["p"]


def test_strip_latex():
    assert ask.strip_latex(r"($\text{CO}_2$) and $5 or $10") == "(CO2) and $5 or $10"


# --- retrieval helpers -----------------------------------------------------------------------

def test_synonyms_expand_keyword_query():
    assert {"suppressant", "extinguish"} <= set(ask.expand("What gases put out flames?"))


def test_bm25_prefers_matching_doc():
    docs = [ask.tokens("helium carbon dioxide suppressant"), ask.tokens("apollo history crew")]
    scores = ask.bm25_scores(ask.tokens("suppressant helium"), docs)
    assert scores[0] > scores[1] == 0


def test_fuse_caps_chunks_per_source():
    metas = [RES_META] * 6 + [PSI_META]
    picked = ask.fuse([0.9, 0.89, 0.88, 0.87, 0.86, 0.85, 0.5], [0] * 7, k=5, metas=metas)
    assert len([i for i in picked if i < 6]) == config.MAX_PER_SOURCE and 6 in picked


# --- explain_ranking -------------------------------------------------------------------------

def ranked():
    from rank.score import rank
    return rank([BY_ID[i] for i in ("PSI-98", "PSI-99", "PSI-25", "PSI-60")], "moon_base")


def test_explain_offline_uses_only_reason_strings():
    results = ranked()
    text, mode = explain.explain_ranking_detailed(results, "moon_base", "all", generator=lambda p: 1 / 0)
    assert mode == "offline"
    reasons = " ".join(b["reason"] for r in results[:3] for b in r["breakdown"])
    assert all(r["psi_id"] in text for r in results[:3])
    assert explain._numbers(text) <= explain._numbers(explain._top3_facts(results))
    assert all(phrase in reasons for phrase in ("Solid fuels", "matches the ventilated scenario"))


def test_explain_rejects_invented_numbers_or_reordering():
    results = ranked()
    ids = [r["psi_id"] for r in results[:3]]
    good = f"[{ids[0]}] leads, then [{ids[1]}], then [{ids[2]}]."
    assert explain.explain_ranking(results, "moon_base", "all", generator=lambda p: good) == good
    invented = f"[{ids[0]}] scored 99.9, then [{ids[1]}], then [{ids[2]}]."
    reordered = f"[{ids[1]}] first, then [{ids[0]}], then [{ids[2]}]."
    for bad in (invented, reordered):
        _, mode = explain.explain_ranking_detailed(results, "moon_base", "all", generator=lambda p, b=bad: b)
        assert mode == "offline"


# --- resources -------------------------------------------------------------------------------

def test_html_to_text_keeps_article_drops_chrome():
    html = """<html><body><header>Site menu</header><nav>Home | About</nav>
      <form id="aspnetForm"><main><h1>Apollo 1</h1><p>The fire started in the cabin.</p>
      <div class="cookie-banner">Accept cookies</div></main></form><footer>Contact</footer>
      <script>var x=1;</script></body></html>"""
    text = fetch_resources.html_to_text(html)
    assert "The fire started in the cabin." in text and "Apollo 1" in text
    for junk in ("Site menu", "Home | About", "Accept cookies", "Contact", "var x"):
        assert junk not in text


def test_resource_check():
    assert fetch_resources.check("word " * 250) is None
    assert "only" in fetch_resources.check("word " * 50)
    assert fetch_resources.check("word " * 120, min_words=100) is None
    assert "initializing" in fetch_resources.check("System is initializing " + "word " * 300)


def test_saved_resources_have_header_and_text():
    for source in fetch_resources.text_sources():
        path = config.RESOURCES_DIR / f"{source['id']}.txt"
        title, url, body = build_index.read_resource(path)
        assert title == source["title"] and url == source["url"]
        assert fetch_resources.check(body, source.get("min_words", config.MIN_RESOURCE_WORDS)) is None


def test_demo_files_present_and_pizza_not_covered():
    answers = json.loads((config.PROCESSED_DIR / "demo_answers.json").read_text(encoding="utf-8"))
    assert len(answers) == 8
    pizza = next(a for a in answers if "pizza" in a["question"])
    assert pizza["mode"] == "not_covered"
    explanations = json.loads((config.PROCESSED_DIR / "demo_explanations.json").read_text(encoding="utf-8"))
    assert set(explanations) == {"moon_base/all", "iss_cabin/all", "spacesuit/all", "moon_base/detection"}


# --- Step 5: shared config/prompt, JSON index, parity, keyword fallback -----------------------

def test_shared_config_and_prompt_are_used():
    shared = json.loads((ROOT / "rag" / "config.json").read_text(encoding="utf-8"))
    assert config.MIN_SIMILARITY == shared["retrieval"]["min_similarity"]
    assert config.SYNONYMS == shared["retrieval"]["synonyms"]
    assert shared["embedding"] == {**shared["embedding"], "model": "gemini-embedding-001", "output_dimensionality": 768}
    assert shared["answer"]["max_question_chars"] == 300
    prompt = ask.build_prompt("Why?", "[S1] (PSI · PSI-98) text")
    assert "QUESTION: Why?" in prompt and "[S1] (PSI · PSI-98) text" in prompt and "{{" not in prompt
    assert "planned" in prompt and "NOT_COVERED" in prompt


def test_vectors_normalized_and_b64_roundtrip():
    import numpy as np
    from rag import embeddings
    vectors = embeddings.normalize([[3.0, 4.0], [0.0, 0.0]])
    assert vectors.dtype == np.float32 and np.allclose(vectors[0], [0.6, 0.8]) and not vectors[1].any()
    assert np.array_equal(embeddings.decode_b64(embeddings.encode_b64(vectors), 2), vectors)


def test_index_file_is_consistent():
    data = json.loads(config.INDEX_FILE.read_text(encoding="utf-8"))
    index = ask.load_index(config.INDEX_FILE)
    assert data["model"] == "gemini-embedding-001" and data["dims"] == 768
    assert len(index["vectors"]) == len(data["chunks"]) and len(index["vectors"][0]) == 768
    norms = [sum(x * x for x in v) for v in index["vectors"][:20]]
    assert all(abs(n - 1) < 1e-4 for n in norms)
    ids = [c["id"] for c in data["chunks"]]
    assert len(ids) == len(set(ids)) and "coverage:gravity" in ids
    for c in data["chunks"]:
        assert {"id", "text", "source_type", "title", "url", "field"} <= set(c)
        assert ("doi" in c and "psi_id" in c) if c["source_type"] == "psi" else "resource_id" in c


def test_python_retrieval_matches_parity_fixture():
    """Same query vectors -> same chunk IDs in the same order (what the website must reproduce)."""
    from rag.embeddings import decode_b64
    fixture = json.loads(config.EVAL_FILE.read_text(encoding="utf-8"))
    assert len(fixture["questions"]) == 8
    for q in fixture["questions"]:
        vector = decode_b64(q["query_vector_b64"], fixture["dims"])[0].tolist()
        hits = ask.retrieve(q["question"], k=fixture["k"], query_vector=vector)
        assert [h["id"] for h in hits] == q["retrieved_ids"], q["question"]
    pizza = next(q for q in fixture["questions"] if "pizza" in q["question"])
    assert pizza["mode"] == "not_covered" and max(pizza["similarities"]) < fixture["min_similarity"]


def test_embedding_failure_gives_keyword_passages_without_llm(monkeypatch):
    def offline(question, k):
        raise ConnectionError("no network")
    result = ask.answer("What gases put out flames in FLEX?", retriever=offline, generator=must_not_call)
    assert result["mode"] == "passages" and result["citations"]
    assert any(c.get("psi_id") == "PSI-69" for c in result["citations"])


def test_coverage_chunk_counts_from_data():
    text = build_index.coverage_text(RECORDS)
    assert "23 of 24: microgravity" in text and "1 of 24: an electric field used to mimic partial gravity (PSI-22" in text
    assert "0 of 24 were run in real Moon (lunar) or Mars (Martian) gravity" in text
    fake = [{**r, "gravity": "microgravity"} for r in RECORDS[:3]]
    assert "3 of 3: microgravity" in build_index.coverage_text(fake)


def test_long_question_is_trimmed():
    seen = {}
    ask.answer("x" * 1000, retriever=lambda q, k: seen.setdefault("q", q) and hits(0.9), generator=lambda p: "y [S1].")
    assert len(seen["q"]) == config.MAX_QUESTION_CHARS
