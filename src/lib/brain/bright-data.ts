// WEDJAT BRAIN — Bright Data Enhanced Data Acquisition Provider
//
// Bright Data provides rich web scraping (full page content as markdown, not
// just search snippets). This is an OPTIONAL enhancement to the Brain's web
// research pipeline. It is:
//   - DISABLED by default (BRIGHTDATA_ENABLED must be explicitly set)
//   - Behind the ZeroCostGovernor (Bright Data is a paid service)
//   - Tracked in CostBudget (counts as a web_request)
//   - Falls back to the DuckDuckGo web search (in ./web-search) when not
//     available — z-ai has been REMOVED by consensus.
//
// Results go through the SAME CANDIDATE pipeline as the DuckDuckGo results:
//   CANDIDATE → EVIDENCE → VALIDATION → QUALITY CHECK → CONTRADICTION CHECK
//   → PROMOTION POLICY → APPROVED STATE
// Never: BRIGHT DATA PAGE → ACTIVE KNOWLEDGE
//
// Security: the API token is NEVER logged, committed, or stored in the DB.

export interface BrightDataSnapshot {
  id: string;
  url: string;
  markdown: string;       // full page content as markdown
  pageTitle: string;
  timestamp: string;
  html2text?: string;
  input?: Record<string, unknown>;
}

export interface BrightDataScrapeResult {
  url: string;
  title: string;
  content: string;        // markdown content (cleaned)
  hostName: string;
  scrapedAt: string;
}

/**
 * Check if Bright Data is enabled and available.
 */
export function isBrightDataEnabled(): boolean {
  return process.env.BRIGHTDATA_ENABLED === "true" &&
    !!process.env.BRIGHTDATA_API_TOKEN;
}

/**
 * Fetch a snapshot by ID from the Bright Data datasets API.
 * Returns the full page content as markdown.
 */
export async function fetchSnapshot(snapshotId: string): Promise<BrightDataSnapshot | null> {
  if (!isBrightDataEnabled()) return null;

  const token = process.env.BRIGHTDATA_API_TOKEN!;
  const base = process.env.BRIGHTDATA_DATASETS_BASE ?? "https://api.brightdata.com/datasets/v3";

  try {
    const resp = await fetch(`${base}/snapshot/${snapshotId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      console.error(`[bright-data] snapshot fetch failed: ${resp.status}`);
      return null;
    }
    const data = await resp.json() as BrightDataSnapshot;
    return data;
  } catch (err) {
    console.error("[bright-data] snapshot fetch error:", (err as Error).message);
    return null;
  }
}

/**
 * Trigger a new scraping job for a URL via Bright Data datasets API.
 * Creates a dataset collection request and returns the snapshot ID.
 * The caller should poll fetchSnapshot() until results are ready.
 */
export async function triggerScrape(url: string, datasetId?: string): Promise<{ snapshotId: string } | null> {
  if (!isBrightDataEnabled()) return null;

  const token = process.env.BRIGHTDATA_API_TOKEN!;
  const base = process.env.BRIGHTDATA_DATASETS_BASE ?? "https://api.brightdata.com/datasets/v3";
  // Default dataset for web scraping (can be overridden)
  const dataset = datasetId ?? process.env.BRIGHTDATA_DEFAULT_DATASET_ID;

  if (!dataset) {
    console.error("[bright-data] no dataset ID configured for scraping");
    return null;
  }

  try {
    const resp = await fetch(`${base}/trigger?dataset_id=${dataset}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ url }]),
    });
    if (!resp.ok) {
      console.error(`[bright-data] trigger failed: ${resp.status}`);
      return null;
    }
    const data = await resp.json() as { snapshot_id: string };
    return { snapshotId: data.snapshot_id };
  } catch (err) {
    console.error("[bright-data] trigger error:", (err as Error).message);
    return null;
  }
}

/**
 * Poll for snapshot results until ready or timeout.
 */
export async function waitForSnapshot(snapshotId: string, maxWaitMs = 60000): Promise<BrightDataSnapshot | null> {
  const start = Date.now();
  const interval = 5000;

  while (Date.now() - start < maxWaitMs) {
    const snapshot = await fetchSnapshot(snapshotId);
    if (snapshot && snapshot.markdown) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return null;
}

/**
 * Clean markdown content — remove navigation, ads, footers.
 * Returns the first N characters of meaningful content.
 */
function cleanMarkdown(md: string, maxLength = 3000): string {
  // Remove image/link markdown artifacts
  let cleaned = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")  // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → just text
    .replace(/^#{1,6}\s+/gm, "")           // headers (keep text)
    .replace(/^\s*[\*\-\+]\s+/gm, "")       // list bullets
    .replace(/^\s*\d+\.\s+/gm, "")          // numbered lists
    .replace(/\n{3,}/g, "\n\n")             // collapse blank lines
    .trim();

  // Truncate to max length at a sentence boundary
  if (cleaned.length > maxLength) {
    const truncated = cleaned.slice(0, maxLength);
    const lastSentence = truncated.lastIndexOf(". ");
    if (lastSentence > maxLength * 0.7) {
      cleaned = truncated.slice(0, lastSentence + 1);
    } else {
      cleaned = truncated + "...";
    }
  }

  return cleaned;
}

/**
 * Scrape a URL using Bright Data and return cleaned content.
 * This is the enhanced alternative to DuckDuckGo web_search — returns full
 * page content instead of just a snippet.
 */
export async function scrapeUrl(url: string): Promise<BrightDataScrapeResult | null> {
  if (!isBrightDataEnabled()) return null;

  // Check ZeroCostGovernor
  try {
    const { ZeroCostGovernor } = await import("./zero-cost-governor");
    const check = await ZeroCostGovernor.canPerform("web_request");
    if (!check.allowed) {
      console.log("[bright-data] blocked by ZeroCostGovernor:", check.reason);
      return null;
    }
  } catch {
    // Governor not available — proceed with caution
  }

  // Trigger scrape
  const trigger = await triggerScrape(url);
  if (!trigger) return null;

  // Wait for results
  const snapshot = await waitForSnapshot(trigger.snapshotId, 60000);
  if (!snapshot) {
    console.error("[bright-data] snapshot timed out");
    return null;
  }

  // Record usage
  try {
    const { ZeroCostGovernor } = await import("./zero-cost-governor");
    await ZeroCostGovernor.record("web_request");
  } catch {}

  // Clean the content
  const content = cleanMarkdown(snapshot.markdown);
  const hostName = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  return {
    url,
    title: snapshot.pageTitle || hostName,
    content,
    hostName,
    scrapedAt: snapshot.timestamp || new Date().toISOString(),
  };
}

/**
 * Enhanced web research using Bright Data.
 * Scrapes multiple URLs and returns rich content for each.
 * Falls back to returning [] (caller should use the DuckDuckGo web_search
 * path in ./web-search.ts — z-ai has been removed by consensus).
 */
export async function brightDataResearch(query: string, maxResults = 3): Promise<BrightDataScrapeResult[]> {
  if (!isBrightDataEnabled()) return [];

  // First, use the DuckDuckGo web search (in ./web-search) to find relevant URLs.
  const { searchWeb } = await import("./web-search");
  const searchResults = await searchWeb(query, maxResults);

  if (!Array.isArray(searchResults) || searchResults.length === 0) return [];

  // Scrape each URL using Bright Data for full content
  const results: BrightDataScrapeResult[] = [];
  for (const r of searchResults.slice(0, maxResults)) {
    const url = r.url as string;
    if (!url) continue;

    const scraped = await scrapeUrl(url);
    if (scraped) {
      results.push(scraped);
    }
  }

  return results;
}
