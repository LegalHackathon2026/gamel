// lib/chunk.js
// ─────────────────────────────────────────────────────────────
// Smart chunking for Nigerian legal documents
// Detects legal sections and splits intelligently
// ─────────────────────────────────────────────────────────────

// Common section headers in Nigerian court judgments
const LEGAL_SECTIONS = [
  "FACTS",
  "BACKGROUND",
  "ISSUES FOR DETERMINATION",
  "ISSUES",
  "SUBMISSIONS",
  "ARGUMENTS",
  "HELD",
  "JUDGMENT",
  "RULING",
  "DECISION",
  "RATIO DECIDENDI",
  "OBITER DICTUM",
  "ORDER",
  "CONCLUSION",
  "DISSENTING OPINION",
  "CONCURRING OPINION",
  // Statute sections
  "PART I",
  "PART II",
  "PART III",
  "CHAPTER",
  "SECTION",
  "SCHEDULE",
  "PREAMBLE",
];

const SECTION_REGEX = new RegExp(
  `^\\s*(${LEGAL_SECTIONS.join("|")})[:\\s.]*$`,
  "gim"
);

/**
 * Basic word-based chunker with overlap
 * Use this for simple documents without clear sections
 */
export function chunkText(text, chunkSize = 500, overlap = 100) {
  const words = text.split(" ").filter(Boolean);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 50) { // skip tiny fragments
      chunks.push(chunk);
    }
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}

/**
 * Section-aware chunker for Nigerian court judgments
 * Splits by detected section headers first, then chunks within sections
 *
 * @param {string} text - Cleaned document text
 * @param {object} options
 * @param {number} options.chunkSize - Max words per chunk (default: 400)
 * @param {number} options.overlap - Word overlap between chunks (default: 80)
 * @returns {Array<{text: string, section: string}>}
 */
export function chunkLegalDocument(text, options = {}) {
  const { chunkSize = 400, overlap = 80 } = options;

  const sections = splitIntoSections(text);
  const allChunks = [];

  for (const { heading, content } of sections) {
    if (!content.trim()) continue;

    const words = content.split(" ").filter(Boolean);

    if (words.length <= chunkSize) {
      // Section is short enough — keep as single chunk
      allChunks.push({
        text: content.trim(),
        section: heading,
      });
    } else {
      // Chunk within the section
      for (let i = 0; i < words.length; i += chunkSize - overlap) {
        const chunk = words.slice(i, i + chunkSize).join(" ");
        if (chunk.trim().length > 50) {
          allChunks.push({
            text: chunk.trim(),
            section: heading,
          });
        }
        if (i + chunkSize >= words.length) break;
      }
    }
  }

  return allChunks;
}

/**
 * Split text into named sections based on detected headers
 * @returns {Array<{heading: string, content: string}>}
 */
function splitIntoSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let currentHeading = "PREAMBLE";
  let currentLines = [];

  for (const line of lines) {
    const isHeader = LEGAL_SECTIONS.some(
      (s) => line.trim().toUpperCase().startsWith(s) && line.trim().length < s.length + 30
    );

    if (isHeader) {
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join(" "),
        });
      }
      currentHeading = line.trim().toUpperCase();
      currentLines = [];
    } else {
      currentLines.push(line.trim());
    }
  }

  // Push final section
  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join(" "),
    });
  }

  return sections.filter((s) => s.content.trim().length > 30);
}

/**
 * Sentence-aware chunker — respects sentence boundaries
 * Useful for legal articles and statutes where sentence integrity matters
 */
export function chunkBySentences(text, maxChunkChars = 1500, overlap = 200) {
  // Split on sentence endings while preserving citations like "(2015) 5 NWLR 123"
  const sentences = text
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).length <= maxChunkChars) {
      current = current ? current + " " + sentence : sentence;
    } else {
      if (current) chunks.push(current);
      // Start new chunk with overlap from end of previous
      const overlapText = current.slice(-overlap);
      current = overlapText ? overlapText + " " + sentence : sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Create structured chunk objects with full metadata
 */
export function buildChunkObjects(chunks, baseMetadata) {
  return chunks.map((chunk, idx) => ({
    text: typeof chunk === "string" ? chunk : chunk.text,
    section: typeof chunk === "object" ? chunk.section : "general",
    chunk_index: idx,
    ...baseMetadata,
  }));
}
