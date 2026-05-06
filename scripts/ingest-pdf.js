#!/usr/bin/env node
// scripts/ingest-pdf.js
// ─────────────────────────────────────────────────────────────
// Batch ingest PDFs from a directory
// Usage: node scripts/ingest-pdf.js ./data/pdfs
//   or:  node scripts/ingest-pdf.js ./data/pdfs/specific-file.pdf
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Import our lib modules (adjust paths if using ESM vs CJS)
import { cleanLegalText, extractYear, extractCaseName, detectDocumentType } from "../lib/clean.js";
import { chunkLegalDocument, buildChunkObjects } from "../lib/chunk.js";
import { batchEmbed } from "../lib/embeddings.js";
import { storeChunks, logIngestion } from "../lib/supabase.js";

// ── PDF Extraction ───────────────────────────────────────────

async function extractPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

// ── Metadata from filename ───────────────────────────────────
// Filename convention: "COURT_CASENAME_YEAR.pdf"
// Example: "SC_Okonkwo-v-State_2018.pdf"

function parseFilename(filename) {
  const base = path.basename(filename, ".pdf");
  const parts = base.split("_");

  const courtMap = {
    SC: "Supreme Court",
    CA: "Court of Appeal",
    FHC: "Federal High Court",
    HC: "High Court",
  };

  return {
    court: courtMap[parts[0]] || parts[0] || null,
    case_name: parts[1]?.replace(/-/g, " ") || null,
    year: parseInt(parts[2]) || null,
    document_title: base,
  };
}

// ── Process a single PDF ─────────────────────────────────────

async function processPDF(filePath, extraMetadata = {}) {
  const filename = path.basename(filePath);
  console.log(`\n📄 Processing: ${filename}`);

  try {
    // Extract
    const rawText = await extractPDF(filePath);
    console.log(`  ✓ Extracted ${rawText.length} chars`);

    // Clean
    const cleanedText = cleanLegalText(rawText);
    console.log(`  ✓ Cleaned → ${cleanedText.length} chars`);

    if (cleanedText.length < 200) {
      console.warn(`  ⚠ Text too short, skipping ${filename}`);
      return { skipped: true, reason: "too_short" };
    }

    // Build metadata
    const filenameMetadata = parseFilename(filename);
    const metadata = {
      ...filenameMetadata,
      case_name: extraMetadata.case_name || filenameMetadata.case_name || extractCaseName(cleanedText),
      year: extraMetadata.year || filenameMetadata.year || extractYear(cleanedText),
      court: extraMetadata.court || filenameMetadata.court,
      topic: extraMetadata.topic || null,
      source: filePath,
      source_type: "pdf",
      doc_type: extraMetadata.doc_type || detectDocumentType(cleanedText),
    };

    // Chunk
    const rawChunks = chunkLegalDocument(cleanedText, { chunkSize: 400, overlap: 80 });
    const chunks = buildChunkObjects(rawChunks, metadata);
    console.log(`  ✓ Created ${chunks.length} chunks`);

    // Embed
    const texts = chunks.map((c) => c.text);
    console.log(`  ⏳ Generating embeddings...`);
    const embeddings = await batchEmbed(texts, { batchSize: 8, delayMs: 1200 });
    console.log(`  ✓ Generated ${embeddings.length} embeddings`);

    // Store
    const storableChunks = chunks.map((chunk, i) => ({
      content: chunk.text,
      embedding: embeddings[i],
      metadata: {
        case_name: chunk.case_name,
        year: chunk.year,
        court: chunk.court,
        topic: chunk.topic,
        section: chunk.section,
        source: chunk.source,
        source_type: chunk.source_type,
        doc_type: chunk.doc_type,
        document_title: chunk.document_title,
        chunk_index: chunk.chunk_index,
      },
    }));

    await storeChunks(storableChunks);
    console.log(`  ✓ Stored ${storableChunks.length} chunks in Supabase`);

    await logIngestion({
      source: filePath,
      sourceType: "pdf",
      status: "done",
      chunkCount: chunks.length,
    });

    return { success: true, chunks: chunks.length, metadata };
  } catch (err) {
    console.error(`  ✗ Error processing ${filename}:`, err.message);
    await logIngestion({
      source: filePath,
      sourceType: "pdf",
      status: "error",
      chunkCount: 0,
      errorMsg: err.message,
    });
    return { success: false, error: err.message };
  }
}

// ── Main Runner ──────────────────────────────────────────────

async function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error("Usage: node scripts/ingest-pdf.js <file-or-directory>");
    process.exit(1);
  }

  const stats = fs.statSync(targetPath);
  let files = [];

  if (stats.isDirectory()) {
    files = fs
      .readdirSync(targetPath)
      .filter((f) => f.endsWith(".pdf"))
      .map((f) => path.join(targetPath, f));
  } else if (targetPath.endsWith(".pdf")) {
    files = [targetPath];
  } else {
    console.error("Target must be a .pdf file or directory containing PDFs");
    process.exit(1);
  }

  console.log(`\n🚀 Gamell PDF Ingestion`);
  console.log(`   Found ${files.length} PDF(s) to process`);
  console.log(`   Provider: ${process.env.DEFAULT_EMBEDDING_PROVIDER || "gemini"}\n`);

  const results = { success: 0, failed: 0, skipped: 0, totalChunks: 0 };

  for (const file of files) {
    const result = await processPDF(file);
    if (result.skipped) results.skipped++;
    else if (result.success) {
      results.success++;
      results.totalChunks += result.chunks;
    } else {
      results.failed++;
    }

    // Pause between files to respect API rate limits
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n─────────────────────────────────");
  console.log("📊 Ingestion Summary:");
  console.log(`   ✓ Success:  ${results.success} files`);
  console.log(`   ✗ Failed:   ${results.failed} files`);
  console.log(`   ⚠ Skipped:  ${results.skipped} files`);
  console.log(`   📦 Chunks:  ${results.totalChunks} stored`);
  console.log("─────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
