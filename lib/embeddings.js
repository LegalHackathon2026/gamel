// lib/embeddings.js
// ─────────────────────────────────────────────────────────────
// Embedding generation — Gemini text-embedding-004 (768 dims)
// The Supabase schema uses vector(768) to match this model.
// Do NOT swap in OpenAI embeddings without also migrating the
// DB column to vector(1536) and re-embedding all documents.
// ─────────────────────────────────────────────────────────────

// ── Gemini text-embedding-004 ────────────────────────────────
// Output: 768-dimensional float vector
// Max input: ~2048 tokens (we slice to ~8000 chars to be safe)

async function getEmbeddingGemini(text) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text.slice(0, 8000));
  return result.embedding.values; // number[768]
}

// ── Main Export ──────────────────────────────────────────────

/**
 * Generate a 768-dim embedding vector using Gemini text-embedding-004.
 * @param {string} text
 * @returns {Promise<number[]>} 768-element array
 */
export async function getEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot embed empty text");
  }

  try {
    return await getEmbeddingGemini(text);
  } catch (err) {
    console.error("Gemini embedding failed:", err.message);
    // Re-throw — do not fall back to OpenAI, as vector dimensions
    // would be incompatible with the vector(768) DB column.
    throw new Error(`Embedding failed: ${err.message}`);
  }
}

/**
 * Batch embed multiple texts with rate limiting
 * @param {string[]} texts
 * @param {object} options
 * @param {number} options.batchSize - items per batch (default: 10)
 * @param {number} options.delayMs - delay between batches in ms (default: 1000)
 */
export async function batchEmbed(texts, options = {}) {
  const { batchSize = 10, delayMs = 1000 } = options;
  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

    const embeddings = await Promise.all(
      batch.map((text) => getEmbedding(text))
    );
    results.push(...embeddings);

    // Rate limit pause between batches
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}
