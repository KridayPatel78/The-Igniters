"""Settings for the AI librarian. Tunable values live in rag/config.json and the answer prompt in
rag/prompt.md - both are shared with the website's TypeScript (/api/ask), so edit them there,
not here. This module only adds local paths."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "rag" / "config.json"
PROMPT_FILE = ROOT / "rag" / "prompt.md"
SOURCES_FILE = ROOT / "rag" / "sources.json"
RESOURCES_DIR = ROOT / "data" / "raw" / "resources"
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
INDEX_FILE = PROCESSED_DIR / "rag_index.json"
EVAL_FILE = PROCESSED_DIR / "rag_eval.json"
EMBED_CACHE_DIR = ROOT / "data" / "interim" / "embeddings"

PSI_PAGE = "https://psi.nasa.gov/physci/repo/data/investigations/{psi_id}"
PSI_TEXT_FIELDS = ("objective", "approach", "hypothesis", "researchImpacts", "description")

SHARED = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
PROMPT_TEMPLATE = PROMPT_FILE.read_text(encoding="utf-8")

EMBEDDING = SHARED["embedding"]
EMBEDDING_MODEL = EMBEDDING["model"]
EMBEDDING_DIMS = EMBEDDING["output_dimensionality"]
DEFAULT_MODEL = SHARED["answer_model_default"]

_R = SHARED["retrieval"]
K = _R["k"]
MIN_SIMILARITY = _R["min_similarity"]
FUSION_DEPTH = _R["fusion_depth"]
RRF_K = _R["rrf_k"]
MAX_PER_SOURCE = _R["max_per_source"]
BM25_K1, BM25_B = _R["bm25"]["k1"], _R["bm25"]["b"]
TOKEN_PATTERN = _R["token_pattern"]
MIN_TOKEN_LENGTH = _R["min_token_length"]
STOPWORDS = frozenset(_R["stopwords"])
SYNONYMS = _R["synonyms"]

CHUNK_CHARS = SHARED["chunking"]["chars"]
CHUNK_OVERLAP = SHARED["chunking"]["overlap"]

_A = SHARED["answer"]
MAX_ANSWER_WORDS = _A["max_words"]
MAX_QUESTION_CHARS = _A["max_question_chars"]
FALLBACK_PASSAGES = _A["fallback_passages"]
FALLBACK_PASSAGE_CHARS = _A["fallback_passage_chars"]
NOT_COVERED = _A["not_covered_text"]
NOT_COVERED_REPLY = _A["not_covered_reply"]
OFFLINE_NOTE = _A["offline_note"]

KNOWN_GAPS = SHARED["known_gaps"]
MIN_RESOURCE_WORDS = SHARED["resources"]["min_words"]
