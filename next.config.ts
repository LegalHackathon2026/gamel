import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 15: turbopack is stable, no longer experimental
  // Enable if you want faster dev builds:
  // bundler: "turbopack",

  serverExternalPackages: ["pdf-parse"],

  env: {
    DEFAULT_AI_PROVIDER: process.env.DEFAULT_AI_PROVIDER ?? "gemini",
    DEFAULT_EMBEDDING_PROVIDER: process.env.DEFAULT_EMBEDDING_PROVIDER ?? "gemini",
    RAG_MATCH_COUNT: process.env.RAG_MATCH_COUNT ?? "5",
    RAG_SIMILARITY_THRESHOLD: process.env.RAG_SIMILARITY_THRESHOLD ?? "0.75",
  },
};

export default nextConfig;
