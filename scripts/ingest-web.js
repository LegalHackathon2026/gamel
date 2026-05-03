#!/usr/bin/env node
// scripts/ingest-web.js
// ─────────────────────────────────────────────────────────────
// Scrape and ingest legal content from web pages
// Usage: node scripts/ingest-web.js
// ─────────────────────────────────────────────────────────────

import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { cleanLegalText, extractYear, detectDocumentType } from "../lib/clean.js";
import { chunkLegalDocument, buildChunkObjects } from "../lib/chunk.js";
import { batchEmbed } from "../lib/embeddings.js";
import { storeChunks, logIngestion } from "../lib/supabase.js";

// ── Target URLs ──────────────────────────────────────────────
// Nigerian legal sources — add more as needed

const SEED_URLS = [
  {
    url: "https://www.lawpavilion.com/blog/nigerian-constitution/",
    metadata: { topic: "Constitutional Law", court: null, doc_type: "statute", jurisdiction: "Nigeria" },
  },
  {
    url: "https://www.lawnigeria.com/judgements/",
    metadata: { topic: "Case Law", doc_type: "case_law", jurisdiction: "Nigeria" },
  },
  // Add judiciary websites, law blogs, etc.
];

// ── Scraper ──────────────────────────────────────────────────

export async function scrapePage(url, options = {}) {
  const { timeout = 10000, selector = "body" } = options;

  const { data } = await axios.get(url, {
    timeout,
    headers: {
      "User-Agent":
"Gamell/1.0 (legal research tool; contact: your@email.com)",
    },
  });

  const $ = cheerio.load(data);

  // Remove nav, footer, ads, scripts
  $("nav, footer, header, script, style, .advertisement, .cookie-banner, aside").remove();

  // Try to find main content area
  const contentSelectors = [
    "article",
    ".post-content",
    ".entry-content",
    ".judgment-content",
    "main",
    "#content",
    selector,
  ];

  let text = "";
  for (const sel of contentSelectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 300) {
      text = el.text();
      break;
    }
  }

  if (!text) text = $("body").text();

  return text;
}

// ── Process a single URL ─────────────────────────────────────

async function processURL(url, extraMetadata = {}) {
  console.log(`\n🌐 Scraping: ${url}`);

  try {
    const rawText = await scrapePage(url);
    console.log(`  ✓ Scraped ${rawText.length} chars`);

    const cleanedText = cleanLegalText(rawText);
    if (cleanedText.length < 300) {
      console.warn(`  ⚠ Content too short, skipping`);
      return { skipped: true };
    }

    const metadata = {
      source: url,
      source_type: "web",
      year: extraMetadata.year || extractYear(cleanedText),
      doc_type: extraMetadata.doc_type || detectDocumentType(cleanedText),
      document_title: extraMetadata.document_title || new URL(url).pathname,
      jurisdiction: extraMetadata.jurisdiction || "Nigeria",
      ...extraMetadata,
    };

    const rawChunks = chunkLegalDocument(cleanedText, { chunkSize: 400, overlap: 80 });
    const chunks = buildChunkObjects(rawChunks, metadata);
    console.log(`  ✓ Created ${chunks.length} chunks`);

    const texts = chunks.map((c) => c.text);
    const embeddings = await batchEmbed(texts, { batchSize: 8, delayMs: 1200 });

    const storableChunks = chunks.map((chunk, i) => ({
      content: chunk.text,
      embedding: embeddings[i],
      metadata: { ...chunk, text: undefined },
    }));

    await storeChunks(storableChunks);
    console.log(`  ✓ Stored ${storableChunks.length} chunks`);

    await logIngestion({
      source: url,
      sourceType: "web",
      status: "done",
      chunkCount: chunks.length,
    });

    return { success: true, chunks: chunks.length };
  } catch (err) {
    console.error(`  ✗ Error:`, err.message);
    await logIngestion({
      source: url,
      sourceType: "web",
      status: "error",
      chunkCount: 0,
      errorMsg: err.message,
    });
    return { success: false, error: err.message };
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const urlArg = process.argv[2];
  const urls = urlArg
    ? [{ url: urlArg, metadata: {} }]
    : SEED_URLS;

  console.log(`\n🚀 Gamell Web Ingestion`);
  console.log(`   Processing ${urls.length} URL(s)\n`);

  let success = 0, failed = 0, totalChunks = 0;

  for (const { url, metadata } of urls) {
    const result = await processURL(url, metadata);
    if (result.success) { success++; totalChunks += result.chunks; }
    else if (!result.skipped) failed++;

    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log(`\n📊 Web Ingestion Summary:`);
  console.log(`   ✓ Success: ${success} URLs`);
  console.log(`   ✗ Failed:  ${failed} URLs`);
  console.log(`   📦 Chunks: ${totalChunks} stored\n`);
}

main().catch(console.error);
