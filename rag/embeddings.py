"""Gemini embeddings (gemini-embedding-001, 768 dims, L2-normalized) + the JSON vector index.

Document vectors are cached by text hash in data/interim/embeddings/ (committed), so rebuilding
the index only calls the API for new or changed chunks. Vectors are stored and compared as
float32 - exactly what the website decodes from rag_index.json - so Python and TypeScript rank
identically.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import time

import numpy as np

from rag import config

BATCH = 100
BACKOFF_S = (5, 15, 30)  # max 3 retries on 429 / 5xx


def normalize(vectors: np.ndarray) -> np.ndarray:
    """L2-normalize rows (truncated Gemini embeddings are not unit length), as float32."""
    vectors = np.asarray(vectors, dtype=np.float64)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return (vectors / np.where(norms == 0, 1, norms)).astype(np.float32)


def encode_b64(vectors: np.ndarray) -> str:
    return base64.b64encode(np.asarray(vectors, dtype="<f4").tobytes()).decode("ascii")


def decode_b64(data: str, dims: int) -> np.ndarray:
    return np.frombuffer(base64.b64decode(data), dtype="<f4").reshape(-1, dims)


def _client():
    from dotenv import load_dotenv
    from google import genai

    load_dotenv(config.ROOT / ".env")
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    return genai.Client(api_key=key)


def _embed_batch(client, texts: list[str], task_type: str) -> list[list[float]]:
    from google.genai import errors, types

    cfg = types.EmbedContentConfig(task_type=task_type, output_dimensionality=config.EMBEDDING_DIMS)
    for attempt in range(len(BACKOFF_S) + 1):
        try:
            result = client.models.embed_content(model=config.EMBEDDING_MODEL, contents=texts, config=cfg)
            return [e.values for e in result.embeddings]
        except errors.APIError as exc:
            retryable = exc.code == 429 or (exc.code or 0) >= 500
            if not retryable or attempt == len(BACKOFF_S):
                raise
            print(f"    embeddings HTTP {exc.code} - retrying in {BACKOFF_S[attempt]} s")
            time.sleep(BACKOFF_S[attempt])
    raise RuntimeError("unreachable")


def embed_query(question: str) -> np.ndarray:
    """One normalized float32 query vector. Raises if the API is unreachable."""
    return normalize([_embed_batch(_client(), [question], config.EMBEDDING["query_task_type"])[0]])[0]


# --- document embeddings with cache ----------------------------------------------------------

def _cache_file():
    return config.EMBED_CACHE_DIR / f"{config.EMBEDDING_MODEL}_{config.EMBEDDING_DIMS}_documents.json"


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def embed_documents(texts: list[str]) -> np.ndarray:
    """Normalized float32 vectors for chunk texts; only uncached texts hit the API."""
    path = _cache_file()
    cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    missing = list(dict.fromkeys(t for t in texts if text_hash(t) not in cache))
    if missing:
        client = _client()
        print(f"  embedding {len(missing)} new chunks with {config.EMBEDDING_MODEL} ({config.EMBEDDING_DIMS} dims)")
        for start in range(0, len(missing), BATCH):
            part = missing[start:start + BATCH]
            vectors = normalize(_embed_batch(client, part, config.EMBEDDING["document_task_type"]))
            for text, vector in zip(part, vectors):
                cache[text_hash(text)] = encode_b64(vector[None, :])
            time.sleep(1)
        used = {text_hash(t) for t in texts}
        cache = {h: v for h, v in sorted(cache.items()) if h in used}  # drop stale entries, stable order
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(cache, indent=0) + "\n", encoding="utf-8")
    return np.vstack([decode_b64(cache[text_hash(t)], config.EMBEDDING_DIMS) for t in texts])
