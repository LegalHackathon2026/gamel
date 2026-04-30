// scripts/scraper.js
// Exported scraper used by both the API route (pages/api/ingest.js)
// and the CLI script (scripts/ingest-web.js)

import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapePage(url, options = {}) {
  const { timeout = 10000, selector = "body" } = options;

  const { data } = await axios.get(url, {
    timeout,
    headers: {
      "User-Agent": "Gamell/1.0 (legal research tool)",
    },
  });

  const $ = cheerio.load(data);

  // Strip non-content elements
  $("nav, footer, header, script, style, .advertisement, .cookie-banner, aside, [role='banner'], [role='navigation']").remove();

  // Try increasingly broad selectors until we get enough text
  const contentSelectors = [
    "article",
    ".post-content",
    ".entry-content",
    ".judgment-content",
    ".case-content",
    "main",
    "#content",
    "#main",
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
