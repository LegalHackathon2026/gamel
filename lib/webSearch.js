// lib/webSearch.js
// ─────────────────────────────────────────────────────────────
// Web search fallback for when RAG results are insufficient
// Uses Brave Search API (or SerpAPI as alternative)
// ─────────────────────────────────────────────────────────────

/**
 * Search the web using Brave Search API
 * @param {string} query
 * @param {number} count - Number of results (max 10)
 */
async function searchBrave(query, count = 5) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY not set");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", `${query} Nigeria law`);
  url.searchParams.set("count", String(count));
  url.searchParams.set("country", "ng");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  const data = await response.json();
  const webResults = data.web?.results || [];

  return webResults.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
    source: "web_search",
  }));
}

/**
 * Search using SerpAPI (alternative to Brave)
 */
async function searchSerpAPI(query, count = 5) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", `${query} Nigeria law`);
  url.searchParams.set("num", String(count));
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString());
  const data = await response.json();

  return (data.organic_results || []).slice(0, count).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    source: "web_search",
  }));
}

/**
 * Main web search function — tries Brave first, falls back to SerpAPI
 * @param {string} query
 * @param {number} count
 * @returns {Promise<Array<{title, url, snippet, source}>>}
 */
export async function webSearch(query, count = 5) {
  try {
    if (process.env.BRAVE_SEARCH_API_KEY) {
      return await searchBrave(query, count);
    }
    if (process.env.SERPAPI_KEY) {
      return await searchSerpAPI(query, count);
    }
    console.warn("No web search API configured. Skipping web search.");
    return [];
  } catch (err) {
    console.error("Web search failed:", err.message);
    return [];
  }
}

/**
 * Format web search results as context text for the LLM
 */
export function formatWebResults(results) {
  if (!results.length) return "";

  return results
    .map(
      (r, i) =>
        `[Web Result ${i + 1}: ${r.title}]\n${r.snippet}\nSource: ${r.url}`
    )
    .join("\n\n---\n\n");
}
