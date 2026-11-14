"""Settings for the AI librarian (rag/). Tune here, not in the modules."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES_FILE = ROOT / "rag" / "sources.json"
RESOURCES_DIR = ROOT / "data" / "raw" / "resources"
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
CHROMA_DIR = ROOT / "data" / "chroma"
COLLECTION = "nasa_fire_safety"

PSI_PAGE = "https://psi.nasa.gov/physci/repo/data/investigations/{psi_id}"
PSI_TEXT_FIELDS = ("objective", "approach", "hypothesis", "researchImpacts", "description")

# Chunking
CHUNK_CHARS = 1000
CHUNK_OVERLAP = 150

# Embeddings (local, CPU-friendly; downloaded once to the Hugging Face cache)
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Retrieval: cosine similarity of the best chunk below this -> "Not covered by our NASA sources"
# without calling Gemini. Calibrated on rag/demo_questions.json (see rag/README.md).
MIN_SIMILARITY = 0.30

# Hybrid retrieval: embedding ranking + BM25 keyword ranking, reciprocal-rank fused (RRF), then at
# most MAX_PER_SOURCE chunks per investigation / resource so one long document (the 50-page
# Researcher's Guide) can't crowd out the PSI investigations.
FUSION_DEPTH = 50
RRF_K = 60
MAX_PER_SOURCE = 3
# Fire-safety vocabulary for the keyword side: a question word also searches these terms.
SYNONYMS = {
    "put out": "extinguish extinguishment suppress suppressant suppressants suppression",
    "extinguish": "extinguishment suppress suppressant suppression",
    "suppress": "suppressant suppressants suppression extinguish extinguishment",
    "gas": "gases gaseous", "gases": "gas gaseous",
    "fabric": "fabrics textile cotton sibal nomex",
    "spread": "spreading propagation",
    "smoke": "aerosol aerosols particulate",
    "detection": "detector detectors detect", "detect": "detector detectors detection",
    "moon": "lunar", "mars": "martian", "gravity": "microgravity reduced-gravity partial",
    "oxygen": "o2", "risk": "hazard hazards danger safety",
}

# Answering
DEFAULT_MODEL = "gemini-3.6-flash"
MAX_ANSWER_WORDS = 150
FALLBACK_PASSAGES = 3
NOT_COVERED = "Not covered by our NASA sources."
OFFLINE_NOTE = "AI summary unavailable — here are the most relevant NASA passages."

# Resource fetching
MIN_RESOURCE_WORDS = 200
