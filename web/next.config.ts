import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Pages read web/data/ at build time; /api/ask reads the search index, shared config and
  // prompt at runtime, so those files must ship with the serverless function.
  outputFileTracingIncludes: {
    "/api/ask": [
      "./data/rag_index.json",
      "./data/rag_config.json",
      "./data/rag_prompt.md",
      "./data/demo_answers.json",
    ],
  },
};

export default nextConfig;
