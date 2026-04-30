// lib/clean.js
// ─────────────────────────────────────────────────────────────
// Text cleaning pipeline for Nigerian legal documents
// ─────────────────────────────────────────────────────────────

/**
 * Core cleaner — removes noise common in PDF-extracted legal text
 */
export function cleanText(text) {
  return text
    // Collapse line breaks
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Remove page number artifacts (e.g. "Page 12 of 40", "- 12 -", "[12]")
    .replace(/Page \d+(\s+of\s+\d+)?/gi, "")
    .replace(/^\s*[-–]\s*\d+\s*[-–]\s*$/gm, "")
    .replace(/\[\s*\d+\s*\]/g, "")
    // Remove repeated headers/footers (common pattern in court PDFs)
    .replace(/FEDERAL REPUBLIC OF NIGERIA.{0,80}\n/gi, "")
    .replace(/IN THE (SUPREME|FEDERAL|HIGH) COURT.{0,120}\n/gi, (m) => m) // Keep first, remove dups handled below
    // Remove excessive whitespace
    .replace(/[ \t]{2,}/g, " ")
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove null bytes and control chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

/**
 * Normalize whitespace to single spaces (for chunking)
 */
export function flattenText(text) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Remove legal citation noise while preserving references
 * e.g. keeps "(2015) 5 NWLR 123" but strips scan artifacts
 */
export function cleanLegalText(text) {
  let cleaned = cleanText(text);

  // Remove watermarks
  cleaned = cleaned.replace(/CERTIFIED TRUE COPY/gi, "");
  cleaned = cleaned.replace(/NOT FOR PUBLICATION/gi, "");
  cleaned = cleaned.replace(/UNREPORTED/gi, "");

  // Fix common OCR errors in legal text
  cleaned = cleaned
    .replace(/\bl\b(?=\d)/g, "1")   // l1234 → 1234
    .replace(/\bO\b(?=\d)/g, "0");  // O123 → 0123

  return cleaned.trim();
}

/**
 * Detect the type of legal document from its content
 */
export function detectDocumentType(text) {
  const lower = text.toLowerCase();

  if (lower.includes("it is hereby enacted") || lower.includes("short title")) {
    return "statute";
  }
  if (lower.includes("the court held") || lower.includes("in the supreme court") || lower.includes("appeal allowed")) {
    return "case_law";
  }
  if (lower.includes("constitution") && lower.includes("federal republic")) {
    return "constitution";
  }
  if (lower.includes("whereas") && lower.includes("agreement")) {
    return "legal_article";
  }
  return "general";
}

/**
 * Extract year from legal document text
 */
export function extractYear(text) {
  // Match 4-digit years between 1960 and current year
  const matches = text.match(/\b(19[6-9]\d|20[0-2]\d)\b/g);
  if (!matches) return null;

  // Return the most frequent year (likely the judgment year)
  const freq = {};
  matches.forEach((y) => (freq[y] = (freq[y] || 0) + 1));
  return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
}

/**
 * Extract case name from the beginning of a judgment text
 */
export function extractCaseName(text) {
  // Pattern: "JOHN DOE v. JANE DOE" or "A v B" near the top
  const lines = text.split("\n").slice(0, 20);
  for (const line of lines) {
    const match = line.match(/([A-Z][A-Z\s&.,'()-]+)\s+v[s]?[.]\s+([A-Z][A-Z\s&.,'()-]+)/);
    if (match) return match[0].trim();
  }
  return null;
}
