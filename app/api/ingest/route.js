// app/api/ingest/route.js
// ─────────────────────────────────────────────────────────────
// Document ingestion endpoint
// POST /api/ingest
// Body: { type: "text"|"url", content|url, metadata }
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  cleanLegalText,
  extractYear,
  extractCaseName,
  detectDocumentType,
} from "@/lib/clean";
import { chunkLegalDocument, buildChunkObjects } from "@/lib/chunk";
import { batchEmbed } from "@/lib/embeddings";
import { storeChunks, logIngestion } from "@/lib/supabase";

export async function POST(request) {
  try {
    // Simple API key guard for ingestion endpoint
    const authHeader = request.headers.get("authorization");
    if (
      authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, content, url, metadata = {} } = body;

    if (!type || (!content && !url)) {
      return NextResponse.json(
        { error: "type and content|url are required" },
        { status: 400 }
      );
    }

    let rawText = "";
    let source = url || "direct_input";

    // ── Step 1: Extract text ──────────────────────────────
    if (type === "text") {
      rawText = content;
    } else if (type === "url") {
      const { scrapePage } = await import("@/scripts/scraper");
      rawText = await scrapePage(url);
      source = url;
    } else {
      return NextResponse.json(
        { error: "type must be 'text' or 'url'" },
        { status: 400 }
      );
    }

    // ── Step 2: Clean ─────────────────────────────────────
    const cleanedText = cleanLegalText(rawText);

    if (cleanedText.length < 100) {
      return NextResponse.json(
        { error: "Extracted text too short to ingest" },
        { status: 400 }
      );
    }

    // ── Step 3: Auto-detect metadata ─────────────────────
    const autoMetadata = {
      case_name: metadata.case_name || extractCaseName(cleanedText),
      year: metadata.year || extractYear(cleanedText),
      court: metadata.court || null,
      topic: metadata.topic || null,
      document_title: metadata.document_title || null,
      source,
      source_type: type === "url" ? "web" : "manual",
      doc_type: metadata.doc_type || detectDocumentType(cleanedText),
    };

    // ── Step 4: Chunk ─────────────────────────────────────
    const rawChunks = chunkLegalDocument(cleanedText, {
      chunkSize: 400,
      overlap: 80,
    });

    const chunks = buildChunkObjects(rawChunks, autoMetadata);
    console.log(`Created ${chunks.length} chunks from document`);

    // ── Step 5: Embed ─────────────────────────────────────
    const texts = chunks.map((c) => c.text);
    const embeddings = await batchEmbed(texts, {
      batchSize: 10,
      delayMs: 1000,
    });

    // ── Step 6: Store ─────────────────────────────────────
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

    await logIngestion({
      source,
      sourceType: autoMetadata.source_type,
      status: "done",
      chunkCount: chunks.length,
    });

    return NextResponse.json(
      {
        success: true,
        chunksIngested: chunks.length,
        metadata: autoMetadata,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Ingestion error:", err);

    return NextResponse.json(
      {
        error: "Ingestion failed",
        detail:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}