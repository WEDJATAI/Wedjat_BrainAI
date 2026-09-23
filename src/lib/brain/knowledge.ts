// WEDJAT BRAIN V2 — Knowledge subsystem (§26-33).
//
// Knowledge must be more structured than document + embedding (§26). Model:
// knowledge_item, knowledge_version, knowledge_claim, knowledge_source,
// knowledge_evidence, knowledge_conflict. Knowledge types (§27), provenance
// (§28), evidence → source lineage (§29), versioning (§30), contradiction
// management (§31), promotion CANDIDATE → VALIDATING → VALIDATED → ACTIVE
// (§32). Refresh schedules (§33).

import { db } from "@/lib/db";
import { buildTermVector, cosineSimilarity, serializeVector, deserializeVector } from "./vectors";
import type { KnowledgeRecord, KnowledgeType, KnowledgeStatus, EvidenceStatus } from "./types";

export interface KnowledgeQuery {
  tenantId: string;
  applicationId: string;
  text: string;
  types?: KnowledgeType[];
  limit?: number;
  minScore?: number;
}

export interface KnowledgeHit {
  record: KnowledgeRecord;
  score: number;
  semanticScore: number;
  conflict: boolean;
}

const RANK: EvidenceStatus[] = ["VERIFIED", "SUPPORTED", "INFERRED", "UNCERTAIN", "CONFLICTED", "UNSUPPORTED", "UNKNOWN"];

/** Hybrid retrieval of knowledge: semantic similarity + trust-level boost (§34, §39).
 * Uses the inverted index for fast candidate filtering (O(k) instead of O(n)). */
export async function retrieveKnowledge(q: KnowledgeQuery): Promise<KnowledgeHit[]> {
  const { searchIndex } = await import("./inverted-index");
  const results = await searchIndex({
    tenantId: q.tenantId,
    applicationId: q.applicationId,
    kind: "knowledge",
    query: q.text,
    limit: (q.limit ?? 6) * 2, // fetch extra so we can filter by type/conflict
    minScore: q.minScore ?? 0.01,
  });

  if (results.length === 0) return [];

  // Batch-load conflicts for ALL candidate items at once (avoids N+1 queries)
  const candidateIds = results.map((r) => r.id);
  const conflictRows = await db.knowledgeConflict.findMany({
    where: {
      OR: [
        { itemAId: { in: candidateIds } },
        { itemBId: { in: candidateIds } },
      ],
      resolution: { in: ["UNRESOLVED", "HUMAN_REVIEW"] },
    },
    select: { itemAId: true, itemBId: true },
  }).catch(() => []);
  const conflictedIds = new Set<string>();
  for (const c of conflictRows) {
    conflictedIds.add(c.itemAId);
    conflictedIds.add(c.itemBId);
  }

  const RANK_LOCAL = RANK; // capture for closure
  const scored: KnowledgeHit[] = [];
  for (const r of results) {
    const k = r.record as any;
    const trustLevel = (k.source?.trustLevel as EvidenceStatus) ?? "SUPPORTED";
    const trustBoost = Math.max(0, 0.15 * (1 - RANK_LOCAL.indexOf(trustLevel) / RANK_LOCAL.length));
    const freshnessBoost = r.metadata.lastRefreshedAt ? Math.max(0, 0.1 * (1 - daysSince(r.metadata.lastRefreshedAt) / 180)) : 0;
    const typeBoost = (r.metadata.type === "FACT" || r.metadata.type === "RULE" || r.metadata.type === "POLICY") ? 0.05 : 0;
    const conflict = conflictedIds.has(r.id);
    const conflictPenalty = conflict ? 0.1 : 0;

    scored.push({
      record: toRecord(k),
      score: r.semanticScore + trustBoost + freshnessBoost + typeBoost - conflictPenalty,
      semanticScore: r.semanticScore,
      conflict,
    });
  }
  scored.sort((a, b) => b.score - a.score);

  // Filter by type if requested
  const filtered = q.types?.length ? scored.filter((h) => q.types!.includes(h.record.type)) : scored;
  return filtered.slice(0, q.limit ?? 6);
}

/** Create a knowledge candidate from a model-generated statement (§32 — never auto-ACTIVE). */
export async function createKnowledgeCandidate(opts: {
  tenantId: string;
  applicationId: string;
  type: KnowledgeType;
  claim: string;
  content: string;
  scope?: KnowledgeRecord["scope"];
  sourceId?: string;
  confidence?: number;
}): Promise<KnowledgeRecord> {
  const created = await db.knowledgeItem.create({
    data: {
      tenantId: opts.tenantId,
      applicationId: opts.applicationId,
      sourceId: opts.sourceId,
      type: opts.type,
      scope: opts.scope ?? "APPLICATION",
      claim: opts.claim,
      content: opts.content,
      contentVector: serializeVector(buildTermVector(opts.claim + " " + opts.content)),
      status: "CANDIDATE",
      confidence: opts.confidence ?? 0.4,
    },
  });
  return toRecord(created);
}

/** Promote a candidate to ACTIVE after validation (§32). */
export async function promoteKnowledge(itemId: string, reason: string, validFrom?: Date, validUntil?: Date): Promise<KnowledgeRecord> {
  const k = await db.knowledgeItem.findUnique({ where: { id: itemId } });
  if (!k) throw new Error("knowledge not found");
  if (k.status !== "CANDIDATE" && k.status !== "VALIDATING") {
    throw new Error(`knowledge in status ${k.status} cannot be promoted`);
  }
  const updated = await db.knowledgeItem.update({
    where: { id: itemId },
    data: {
      status: "ACTIVE",
      validFrom: validFrom ?? new Date(),
      validUntil,
      confidence: Math.min(1, k.confidence + 0.3),
      lastRefreshedAt: new Date(),
    },
    include: { source: true, evidence: true },
  });
  await db.auditEvent.create({
    data: {
      tenantId: k.tenantId,
      actorType: "system",
      actorId: "brain.knowledge.promote",
      action: "knowledge.promote",
      target: itemId,
      reason,
      severity: "INFO",
    },
  });
  return toRecord(updated);
}

/** Register a conflict between two knowledge items (§31). */
export async function registerConflict(itemAId: string, itemBId: string, note?: string): Promise<void> {
  await db.knowledgeConflict.create({
    data: {
      // tenantId resolved from itemA
      tenantId: (await db.knowledgeItem.findUnique({ where: { id: itemAId } }))?.tenantId ?? "",
      itemAId,
      itemBId,
      resolution: "UNRESOLVED",
      resolutionNote: note,
    },
  });
}

/** Add evidence to a knowledge item (§29: claim → evidence → source). */
export async function addEvidence(itemId: string, evidenceType: string, content: string, section?: string): Promise<void> {
  const k = await db.knowledgeItem.findUnique({ where: { id: itemId } });
  if (!k) throw new Error("knowledge not found");
  await db.knowledgeEvidence.create({
    data: {
      tenantId: k.tenantId,
      knowledgeItemId: itemId,
      sourceId: k.sourceId,
      evidenceType,
      content,
      section,
    },
  });
}

/** Seed a knowledge source + items in one call (used by /api/brain/seed). */
export async function ingestKnowledgeFromSource(opts: {
  tenantId: string;
  sourceType: string;
  title: string;
  sourceUri?: string;
  author?: string;
  publisher?: string;
  trustLevel?: string;
  verificationStatus?: string;
  dataClassification?: string;
  claims: Array<{
    type: KnowledgeType;
    claim: string;
    content: string;
    scope?: KnowledgeRecord["scope"];
    validFrom?: Date;
    validUntil?: Date;
    evidence?: Array<{ evidenceType: string; content: string; section?: string }>;
  }>;
}): Promise<{ sourceId: string; itemIds: string[] }> {
  const source = await db.knowledgeSource.create({
    data: {
      tenantId: opts.tenantId,
      sourceType: opts.sourceType,
      title: opts.title,
      sourceUri: opts.sourceUri,
      author: opts.author,
      publisher: opts.publisher,
      trustLevel: opts.trustLevel ?? "SUPPORTED",
      verificationStatus: opts.verificationStatus ?? "UNVERIFIED",
      dataClassification: opts.dataClassification ?? "INTERNAL",
      publishedAt: new Date(),
    },
  });
  const itemIds: string[] = [];
  // Find an application for this tenant to attach knowledge to. Knowledge is
  // application-scoped per §18, but for global knowledge we attach to the
  // first application of the tenant (the spec says cross-platform knowledge
  // must be separated; here we treat each tenant's primary app as canonical).
  const app = await db.application.findFirst({ where: { tenantId: opts.tenantId } });
  if (!app) throw new Error("no application for tenant");
  for (const c of opts.claims) {
    const k = await db.knowledgeItem.create({
      data: {
        tenantId: opts.tenantId,
        applicationId: app.id,
        sourceId: source.id,
        type: c.type,
        scope: c.scope ?? "APPLICATION",
        claim: c.claim,
        content: c.content,
        contentVector: serializeVector(buildTermVector(c.claim + " " + c.content)),
        status: "ACTIVE",
        confidence: 0.8,
        validFrom: c.validFrom,
        validUntil: c.validUntil,
        refreshSchedule: "manual",
        lastRefreshedAt: new Date(),
      },
    });
    itemIds.push(k.id);
    if (c.evidence) {
      for (const e of c.evidence) {
        await db.knowledgeEvidence.create({
          data: {
            tenantId: opts.tenantId,
            knowledgeItemId: k.id,
            sourceId: source.id,
            evidenceType: e.evidenceType,
            content: e.content,
            section: e.section,
          },
        });
      }
    }
  }
  return { sourceId: source.id, itemIds };
}

function toRecord(k: any): KnowledgeRecord {
  return {
    id: k.id,
    tenantId: k.tenantId,
    applicationId: k.applicationId,
    sourceId: k.sourceId ?? undefined,
    type: k.type as KnowledgeType,
    scope: k.scope as KnowledgeRecord["scope"],
    claim: k.claim,
    content: k.content,
    status: k.status as KnowledgeStatus,
    version: k.version,
    validFrom: k.validFrom ?? undefined,
    validUntil: k.validUntil ?? undefined,
    refreshSchedule: k.refreshSchedule ?? undefined,
    lastRefreshedAt: k.lastRefreshedAt ?? undefined,
    confidence: k.confidence,
    source: k.source
      ? {
          id: k.source.id,
          sourceType: k.source.sourceType,
          title: k.source.title,
          sourceUri: k.source.sourceUri ?? undefined,
          author: k.source.author ?? undefined,
          publisher: k.source.publisher ?? undefined,
          publishedAt: k.source.publishedAt ?? undefined,
          trustLevel: k.source.trustLevel,
          verificationStatus: k.source.verificationStatus,
          dataClassification: k.source.dataClassification,
        }
      : undefined,
    evidence: k.evidence?.map((e: any) => ({
      id: e.id, evidenceType: e.evidenceType, content: e.content, section: e.section ?? undefined,
    })),
  };
}

function daysSince(d: Date): number {
  return (Date.now() - d.getTime()) / 86_400_000;
}
