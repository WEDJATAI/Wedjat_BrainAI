// WEDJAT BRAIN V2 — Retrieval engine (§34-40).
//
// Hybrid retrieval: semantic (§35) + keyword (§36) + structured SQL (§37).
// Then metadata filtering → deduplication → reranking (§39) → evidence
// filtering (§40) → context assembly. Security filtering happens BEFORE any
// unauthorized content can become part of model context (§40).

import { db } from "@/lib/db";
import { retrieveMemory } from "./memory";
import { retrieveKnowledge } from "./knowledge";
import { jaccardSimilarity } from "./vectors";
import type { RetrievalCandidate, IdentityContext } from "./types";

export interface RetrievalRequest {
  identity: IdentityContext;
  text: string;
  topK?: number;
  includeMemory?: boolean;
  includeKnowledge?: boolean;
}

/** Detect deterministic structured lookups (§37, §191). */
export interface StructuredLookup {
  matched: boolean;
  kind: "invoice" | "order" | "user" | "policy_id" | "none";
  identifier?: string;
  value?: unknown;
  reason: string;
}

/** §38 deterministic task router — try a structured lookup before LLM. */
export async function attemptStructuredLookup(text: string, identity: IdentityContext): Promise<StructuredLookup> {
  // "invoice #1827" or "invoice 1827"
  const invoiceMatch = text.match(/invoice\s*#?\s*(\d+)/i);
  if (invoiceMatch) {
    const id = invoiceMatch[1];
    // We don't have a real invoice table; simulate a structured hit against a
    // seeded "invoice" document/knowledge item if present.
    const k = await db.knowledgeItem.findFirst({
      where: {
        tenantId: identity.tenant.id,
        type: "FACT",
        OR: [
          { claim: { contains: id } },
          { content: { contains: id } },
        ],
      },
    });
    if (k) {
      return {
        matched: true, kind: "invoice", identifier: id, value: { claim: k.claim, content: k.content },
        reason: `structured match on invoice id ${id} — no reasoning model required (§37)`,
      };
    }
    return { matched: false, kind: "none", reason: `no invoice ${id} found in structured store` };
  }
  return { matched: false, kind: "none", reason: "no deterministic pattern detected" };
}

/** Run hybrid retrieval across memory + knowledge, rerank, and deduplicate. */
export async function hybridRetrieve(req: RetrievalRequest): Promise<{
  candidates: RetrievalCandidate[];
  structured: StructuredLookup;
}> {
  const [memory, knowledge, structured] = await Promise.all([
    req.includeMemory === false ? Promise.resolve([]) : retrieveMemory({
      tenantId: req.identity.tenant.id,
      applicationId: req.identity.application.id,
      userId: req.identity.user?.id,
      text: req.text,
      limit: 8,
    }),
    req.includeKnowledge === false ? Promise.resolve([]) : retrieveKnowledge({
      tenantId: req.identity.tenant.id,
      applicationId: req.identity.application.id,
      text: req.text,
      limit: 6,
    }),
    attemptStructuredLookup(req.text, req.identity),
  ]);

  const candidates: RetrievalCandidate[] = [];

  for (const m of memory) {
    const keyword = jaccardSimilarity(req.text, m.record.content);
    candidates.push({
      kind: "memory",
      id: m.record.id,
      score: 0.7 * m.score + 0.3 * keyword,
      semanticScore: m.score,
      keywordScore: keyword,
      content: m.record.content,
      source: m.record.source,
      type: `${m.record.domain}/${m.record.type}`,
      scope: m.record.scope,
      validFrom: m.record.validFrom,
      validUntil: m.record.validUntil,
      record: m.record,
    });
  }

  for (const k of knowledge) {
    const keyword = jaccardSimilarity(req.text, k.record.claim + " " + k.record.content);
    candidates.push({
      kind: "knowledge",
      id: k.record.id,
      score: 0.6 * k.score + 0.4 * keyword,
      semanticScore: k.semanticScore,
      keywordScore: keyword,
      content: k.record.claim,
      source: k.record.source?.title,
      type: k.record.type,
      scope: k.record.scope,
      validFrom: k.record.validFrom,
      validUntil: k.record.validUntil,
      evidenceStatus: k.record.source?.trustLevel as any,
      record: k.record,
    });
  }

  // §39 reranking already done via score formula; dedup by content hash.
  const seen = new Set<string>();
  const deduped = candidates.filter((c) => {
    const key = c.content.slice(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => b.score - a.score);
  return { candidates: deduped.slice(0, req.topK ?? 10), structured };
}
