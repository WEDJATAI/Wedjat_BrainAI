// Cirkle Brain AI — Web Research module (spec §115: BRAIN RESEARCH)
//
// When local knowledge is insufficient (verification status UNKNOWN, §163), the
// Brain may perform web research: search the internet, ingest results as new
// knowledge candidates with provenance=web, and use them as model context.
//
// Per spec §115: "External web content remains untrusted." Per §58: tool
// output and retrieved content must never be treated as system instructions.
// Per §35: no self-reinforcing hallucination — web results go through the
// candidate → evidence → promotion pipeline, never raw-answer → truth.
//
// Per user request: the Brain should "search the internet and learn and
// expand its knowledge" — so web-sourced facts are auto-promoted to ACTIVE
// with clear provenance=web so future questions are answered instantly.
//
// CONSENSUS: z-ai web_search has been removed. The Brain now uses the free
// DuckDuckGo Instant Answer API + lite HTML fallback for web search results.

import { db } from "@/lib/db";
import { buildTermVector, serializeVector } from "./vectors";
import type { EvidenceRef, EvidenceStatus } from "./types";

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  hostName: string;
  date?: string;
}

export interface IngestedKnowledge {
  itemId: string;
  claim: string;
  content: string;
  sourceTitle: string;
  sourceUri: string;
  evidenceStatus: EvidenceStatus;
  freshlyIngested: boolean; // true if just created, false if already existed
}

// In-memory cache (per process) to avoid re-searching identical queries.
// Keyed by `${tenantId}:${query.toLowerCase().trim()}`. TTL 10 minutes.
const searchCache = new Map<string, { results: WebSearchResult[]; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Search the web using DuckDuckGo Instant Answer API.
 * Returns up to `num` results. Falls back to DuckDuckGo HTML scraping if the
 * Instant Answer API returns nothing (common for non-headline queries).
 */
export async function searchWeb(query: string, num = 6): Promise<WebSearchResult[]> {
  if (!query?.trim()) return [];
  try {
    const results: WebSearchResult[] = [];

    // 1. DuckDuckGo Instant Answer API — structured JSON.
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1`;
      const resp = await fetch(ddgUrl, {
        headers: { "User-Agent": "CirkleBrainAI/1.0 (+https://cirkle-brain-ai.vercel.app)" },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        const pushItem = (it: any) => {
          if (!it) return;
          const url = it.FirstURL ?? it.URL ?? "";
          const title = it.Text ?? it.Heading ?? "";
          const snippet = it.AbstractText ?? it.Abstract ?? "";
          if (!url && !title) return;
          results.push({
            url: url || "https://duckduckgo.com",
            title: title || "(untitled)",
            snippet: snippet || title,
            hostName: hostFromUrl(url),
          });
        };
        pushItem({ FirstURL: data.AbstractURL, Text: data.Heading, AbstractText: data.AbstractText, Abstract: data.Abstract });
        if (Array.isArray(data.RelatedTopics)) {
          for (const t of data.RelatedTopics) {
            if (results.length >= num) break;
            if (t && t.FirstURL) pushItem(t);
            if (t && Array.isArray(t.Topics)) {
              for (const sub of t.Topics) {
                if (results.length >= num) break;
                pushItem(sub);
              }
            }
          }
        }
        if (Array.isArray(data.Results)) {
          for (const r of data.Results) {
            if (results.length >= num) break;
            pushItem(r);
          }
        }
      }
    } catch (err) {
      console.error("[web-search] duckduckgo instant answer failed:", (err as Error).message);
    }

    // 2. If Instant Answer returned nothing, fall back to DuckDuckGo HTML lite
    //    endpoint and parse visible result anchors + snippets. This is the same
    //    approach used by most open-source search aggregators.
    if (results.length === 0) {
      try {
        const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const resp = await fetch(htmlUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; CirkleBrainAI/1.0; +https://cirkle-brain-ai.vercel.app)",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (resp.ok) {
          const html = await resp.text();
          const parsed = parseDuckDuckGoHtml(html, num);
          results.push(...parsed);
        }
      } catch (err) {
        console.error("[web-search] duckduckgo html fallback failed:", (err as Error).message);
      }
    }

    return results.slice(0, num);
  } catch (err) {
    console.error("[web-search] search failed:", err);
    return [];
  }
}

function hostFromUrl(url: string): string {
  if (!url) return "";
  try { return new URL(url).hostname; } catch { return url; }
}

// Simple HTML result parser for DuckDuckGo's lite/html endpoint.
// Looks for result links: <a class="result__a" href="...">title</a>
// And snippets: <a class="result__snippet" ...>snippet</a>
function parseDuckDuckGoHtml(html: string, max: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html)) !== null) {
    snippets.push(stripTags(sm[1]).trim());
  }

  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) !== null && results.length < max) {
    let rawUrl = lm[1];
    // DuckDuckGo wraps external URLs in a redirect like //duckduckgo.com/l/?uddg=ENC...
    const uddg = rawUrl.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try { rawUrl = decodeURIComponent(uddg[1]); } catch { /* keep raw */ }
    }
    if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;
    const title = stripTags(lm[2]).trim();
    if (!title) continue;
    results.push({
      url: rawUrl,
      title,
      snippet: snippets[i] ?? "",
      hostName: hostFromUrl(rawUrl),
    });
    i++;
  }
  return results;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cached search wrapper — avoids duplicate API calls for identical queries. */
export async function cachedSearchWeb(query: string, tenantId: string, num = 6): Promise<WebSearchResult[]> {
  const key = `${tenantId}:${query.toLowerCase().trim()}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.results;
  }
  const results = await searchWeb(query, num);
  searchCache.set(key, { results, ts: Date.now() });
  // Evict stale entries to prevent unbounded growth
  if (searchCache.size > 200) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of searchCache) if (v.ts < cutoff) searchCache.delete(k);
  }
  return results;
}

/**
 * Ingest web search results as ACTIVE knowledge items (spec §115, §32).
 * Per user request: auto-promote web-sourced facts so the Brain learns and
 * expands. Provenance is preserved (sourceType=web, sourceUri=url) so the
 * Brain always knows where the knowledge came from.
 *
 * Returns the ingested items as EvidenceRefs for the response.
 */
export async function ingestWebResultsAsKnowledge(opts: {
  tenantId: string;
  applicationId: string;
  query: string;
  results: WebSearchResult[];
}): Promise<IngestedKnowledge[]> {
  const { tenantId, applicationId, query, results } = opts;
  if (results.length === 0) return [];

  // Find or create the web-search knowledge source (one shared source for all
  // web-sourced knowledge, per tenant).
  let source = await db.knowledgeSource.findFirst({
    where: { tenantId, title: "Web Research (auto-ingested)" },
  });
  if (!source) {
    source = await db.knowledgeSource.create({
      data: {
        tenantId,
        sourceType: "web",
        title: "Web Research (auto-ingested)",
        author: "Cirkle Brain Web Research",
        trustLevel: "SUPPORTED", // web content is supported but not VERIFIED (§110)
        verificationStatus: "UNVERIFIED", // §115: external content is untrusted until cross-validated
        dataClassification: "PUBLIC",
      },
    });
  }

  const ingested: IngestedKnowledge[] = [];
  for (const r of results) {
    if (!r.snippet || r.snippet.length < 30) continue; // skip low-quality snippets

    const claim = r.title ? `${r.title}` : r.snippet.slice(0, 120);
    const content = r.snippet;

    // Check if this exact content already exists (idempotent — don't duplicate)
    const existing = await db.knowledgeItem.findFirst({
      where: { tenantId, sourceId: source.id, content },
    });
    if (existing) {
      ingested.push({
        itemId: existing.id,
        claim: existing.claim,
        content: existing.content,
        sourceTitle: r.hostName,
        sourceUri: r.url,
        evidenceStatus: "SUPPORTED",
        freshlyIngested: false,
      });
      continue;
    }

    // Create new knowledge item — auto-promoted to ACTIVE per user request
    // ("learn and expand its knowledge"). Provenance preserved.
    const k = await db.knowledgeItem.create({
      data: {
        tenantId,
        applicationId,
        sourceId: source.id,
        type: "FACT",
        scope: "APPLICATION",
        claim,
        content,
        contentVector: serializeVector(buildTermVector(claim + " " + content + " " + query)),
        status: "ACTIVE",
        confidence: 0.65, // web-sourced, lower confidence than verified docs
        validFrom: new Date(),
        refreshSchedule: "manual",
        lastRefreshedAt: new Date(),
      },
    });

    // Add evidence pointing to the source URL (§29 lineage)
    await db.knowledgeEvidence.create({
      data: {
        tenantId,
        knowledgeItemId: k.id,
        sourceId: source.id,
        evidenceType: "citation",
        content: r.url,
        section: r.hostName,
      },
    });

    ingested.push({
      itemId: k.id,
      claim,
      content,
      sourceTitle: r.hostName,
      sourceUri: r.url,
      evidenceStatus: "SUPPORTED",
      freshlyIngested: true,
    });
  }

  // Audit the auto-promotion (§129 — significant action)
  await db.auditEvent.create({
    data: {
      tenantId,
      actorType: "system",
      actorId: "brain.web-research",
      action: "knowledge.ingested_from_web",
      target: source.id,
      reason: `Auto-ingested ${ingested.filter((i) => i.freshlyIngested).length} web results for query: "${query.slice(0, 100)}"`,
      severity: "INFO",
    },
  }).catch(() => {});

  // Invalidate the knowledge index cache so the newly ingested items are
  // discoverable on the next retrieval.
  const { invalidateIndex } = await import("./inverted-index");
  invalidateIndex(opts.tenantId, "knowledge");

  return ingested;
}

/** Convert ingested knowledge to EvidenceRefs for the BrainResponse. */
export function ingestedToEvidence(items: IngestedKnowledge[]): EvidenceRef[] {
  return items.map((i) => ({
    id: i.itemId,
    type: "FACT",
    claim: i.claim,
    sourceTitle: i.sourceTitle,
    sourceUri: i.sourceUri,
    evidenceStatus: i.evidenceStatus,
    retrievedAt: new Date().toISOString(),
    conflict: false,
  }));
}

/**
 * Full research flow: search the web + ingest results as knowledge.
 * Used by the runtime when local retrieval is insufficient (§163 UNKNOWN).
 */
export async function researchAndLearn(opts: {
  tenantId: string;
  applicationId: string;
  query: string;
  maxResults?: number;
}): Promise<{
  results: WebSearchResult[];
  ingested: IngestedKnowledge[];
  evidence: EvidenceRef[];
}> {
  const results = await cachedSearchWeb(opts.query, opts.tenantId, opts.maxResults ?? 6);
  const ingested = await ingestWebResultsAsKnowledge({
    tenantId: opts.tenantId,
    applicationId: opts.applicationId,
    query: opts.query,
    results,
  });
  const evidence = ingestedToEvidence(ingested);
  return { results, ingested, evidence };
}
