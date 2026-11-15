// Shape of web/data/rag_config.json (a copy of rag/config.json, shared with Python).

export interface RagConfig {
  embedding: {
    model: string;
    output_dimensionality: number;
    document_task_type: string;
    query_task_type: string;
    normalize: string;
  };
  answer_model_default: string;
  retrieval: {
    k: number;
    min_similarity: number;
    fusion: string;
    fusion_depth: number;
    rrf_k: number;
    max_per_source: number;
    bm25: { k1: number; b: number };
    token_pattern: string;
    min_token_length: number;
    stopwords: string[];
    synonyms: Record<string, string>;
  };
  chunking: { chars: number; overlap: number };
  answer: {
    max_words: number;
    max_question_chars: number;
    fallback_passages: number;
    fallback_passage_chars: number;
    not_covered_text: string;
    not_covered_reply: string;
    offline_note: string;
  };
  known_gaps: { trigger_keywords: string[]; note: string };
  resources: { min_words: number };
}

/** True when the question is about the Moon / partial or reduced gravity. */
export function mentionsKnownGap(question: string, cfg: Pick<RagConfig, "known_gaps">): boolean {
  const q = question.toLowerCase();
  return cfg.known_gaps.trigger_keywords.some((k) =>
    new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(q),
  );
}
