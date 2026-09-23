// WEDJAT BRAIN V2 — Memory subsystem (§20-25).
//
// Three explicit memory domains (§20): EPISODIC (what happened), SEMANTIC
// (durable facts/preferences), PROCEDURAL (how to do things, versioned).
// Lifecycle (§21): RAW → CANDIDATE → VALIDATING → VALIDATED → ACTIVE →
// SUPERSEDED/EXPIRED/REJECTED/DELETED. Promotion rules (§23): strong signals
// (explicit user instruction, confirmed stable fact) vs weak signals (one-off
// model assumption). Decay (§24) separates historical retention from
// retrieval relevance.

import { db } from "@/lib/db";
import { buildTermVector, cosineSimilarity, serializeVector, deserializeVector } from "./vectors";
import type { MemoryRecord, MemoryDomain, MemoryStatus, IdentityContext } from "./types";

export interface MemoryQuery {
  tenantId: string;
  applicationId: string;
  userId?: string;
  conversationId?: string;
  text: string;
  domains?: MemoryDomain[];
  limit?: number;
  minScore?: number;
}

export interface MemoryHit {
  record: MemoryRecord;
  score: number;
  vector: ReturnType<typeof deserializeVector>;
}

/** Retrieve relevant memory via semantic similarity on stored term vectors.
 * Uses the inverted index for fast candidate filtering. */
export async function retrieveMemory(q: MemoryQuery): Promise<MemoryHit[]> {
  const { searchIndex } = await import("./inverted-index");
  const results = await searchIndex({
    tenantId: q.tenantId,
    applicationId: q.applicationId,
    kind: "memory",
    query: q.text,
    limit: (q.limit ?? 8) * 2,
    minScore: q.minScore ?? 0.01,
    userId: q.userId,
  });

  const queryVec = buildTermVector(q.text);
  const scored: MemoryHit[] = [];
  for (const r of results) {
    const m = r.record as any;
    // §40: USER-scoped memories only visible to that user.
    if (m.scope === "USER" && q.userId && m.userId !== q.userId) continue;
    if (m.scope === "SESSION" && q.conversationId && m.conversationId !== q.conversationId) continue;
    // Temporal decay: validUntil in past → skip
    if (m.validUntil && new Date(m.validUntil) < new Date()) continue;
    const recencyBoost = m.validFrom ? Math.max(0, 0.1 * (1 - daysSince(new Date(m.validFrom)) / 365)) : 0;
    const score = r.semanticScore + recencyBoost;
    if (score < (q.minScore ?? 0.05)) continue;
    scored.push({
      record: toRecord(m),
      score,
      vector: deserializeVector(m.contentVector),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, q.limit ?? 8);
}

/** Stage a learning candidate (§22, §94). Does NOT auto-promote. */
export async function createMemoryCandidate(opts: {
  tenantId: string;
  applicationId: string;
  userId?: string;
  conversationId?: string;
  domain: MemoryDomain;
  type: string;
  scope: MemoryRecord["scope"];
  content: string;
  source: string;
  confidence?: number;
}): Promise<{ id: string; status: MemoryStatus; novelty: number; conflict: boolean }> {
  // §22 novelty check — is there an existing memory that already captures this?
  const existing = await db.memoryItem.findMany({
    where: { tenantId: opts.tenantId, applicationId: opts.applicationId, domain: opts.domain, content: opts.content },
    take: 1,
  });
  const conflict = existing.length > 0 && existing[0].status === "ACTIVE" && existing[0].content !== opts.content;

  const created = await db.memoryItem.create({
    data: {
      tenantId: opts.tenantId,
      applicationId: opts.applicationId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      domain: opts.domain,
      type: opts.type,
      scope: opts.scope,
      content: opts.content,
      contentVector: serializeVector(buildTermVector(opts.content)),
      source: opts.source,
      confidence: opts.confidence ?? 0.5,
      status: "CANDIDATE", // §21 — candidate, never auto-active (Rule 9)
    },
  });
  return { id: created.id, status: "CANDIDATE", novelty: existing.length === 0 ? 1 : 0.2, conflict };
}

/** Promote a candidate memory to ACTIVE (§23). Requires explicit decision. */
export async function promoteMemory(memoryId: string, reason: string): Promise<MemoryRecord> {
  const m = await db.memoryItem.findUnique({ where: { id: memoryId } });
  if (!m) throw new Error("memory not found");
  if (m.status !== "CANDIDATE" && m.status !== "VALIDATING") {
    throw new Error(`memory in status ${m.status} cannot be promoted`);
  }
  const updated = await db.memoryItem.update({
    where: { id: memoryId },
    data: { status: "ACTIVE", validFrom: new Date(), confidence: Math.min(1, m.confidence + 0.2) },
  });
  await db.auditEvent.create({
    data: {
      tenantId: m.tenantId,
      requestId: null,
      actorType: "system",
      actorId: "brain.memory.promote",
      action: "memory.promote",
      target: memoryId,
      reason,
      severity: "INFO",
    },
  });
  return toRecord(updated);
}

/** Supersede an existing memory with a new version (§30, §188). */
export async function supersedeMemory(oldId: string, newContent: string, reason: string): Promise<MemoryRecord> {
  const old = await db.memoryItem.findUnique({ where: { id: oldId } });
  if (!old) throw new Error("old memory not found");
  const newRecord = await db.memoryItem.create({
    data: {
      tenantId: old.tenantId,
      applicationId: old.applicationId,
      userId: old.userId,
      conversationId: old.conversationId,
      domain: old.domain,
      type: old.type,
      scope: old.scope,
      content: newContent,
      contentVector: serializeVector(buildTermVector(newContent)),
      source: old.source,
      confidence: Math.min(1, old.confidence + 0.1),
      status: "ACTIVE",
      version: old.version + 1,
      supersedesId: old.id,
      validFrom: new Date(),
    },
  });
  await db.memoryItem.update({
    where: { id: old.id },
    data: { status: "SUPERSEDED", supersededById: newRecord.id, validUntil: new Date() },
  });
  await db.auditEvent.create({
    data: {
      tenantId: old.tenantId,
      actorType: "system",
      actorId: "brain.memory.supersede",
      action: "memory.supersede",
      target: oldId,
      reason,
      severity: "INFO",
    },
  });
  return toRecord(newRecord);
}

/** Record an episodic event (conversation message) — §20.1. */
export async function recordEpisodic(opts: {
  tenantId: string;
  applicationId: string;
  userId?: string;
  conversationId?: string;
  type: string;
  content: string;
  source: string;
}): Promise<MemoryRecord> {
  const created = await db.memoryItem.create({
    data: {
      tenantId: opts.tenantId,
      applicationId: opts.applicationId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      domain: "EPISODIC",
      type: opts.type,
      scope: opts.conversationId ? "SESSION" : "USER",
      content: opts.content,
      contentVector: serializeVector(buildTermVector(opts.content)),
      source: opts.source,
      confidence: 1.0, // episodic events are observed facts, not inferred
      status: "ACTIVE",
      validFrom: new Date(),
    },
  });
  return toRecord(created);
}

function toRecord(m: any): MemoryRecord {
  return {
    id: m.id,
    tenantId: m.tenantId,
    applicationId: m.applicationId,
    userId: m.userId ?? undefined,
    conversationId: m.conversationId ?? undefined,
    domain: m.domain as MemoryDomain,
    type: m.type,
    scope: m.scope as MemoryRecord["scope"],
    content: m.content,
    source: m.source ?? undefined,
    confidence: m.confidence,
    status: m.status as MemoryStatus,
    version: m.version,
    validFrom: m.validFrom ?? undefined,
    validUntil: m.validUntil ?? undefined,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function daysSince(d: Date): number {
  return (Date.now() - d.getTime()) / 86_400_000;
}

export function scopeForUserMemory(identity: IdentityContext): MemoryRecord["scope"] {
  // §18 — prefer the narrowest scope that still persists appropriately.
  if (identity.session) return "SESSION";
  if (identity.user) return "USER";
  return "APPLICATION";
}
