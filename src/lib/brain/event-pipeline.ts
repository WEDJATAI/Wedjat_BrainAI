// WEDJAT BRAIN V2 — Shared cross-platform event pipeline (spec §21, §94-97).
//
// Extracted from /api/brain/events/process/route.ts so that the same pipeline
// logic can be driven by:
//   1. The REST endpoint POST /api/brain/events/process (cron / dev trigger).
//   2. The Inngest background function `brain-event-pipeline` (§65).
//
// §21 pipeline (per RECEIVED event):
//   RECEIVED → CLASSIFIED → SECURITY_CHECKED → PROVENANCE_ATTACHED →
//   DUPLICATE_CHECKED → NOVELTY_SCORED → PROMOTION_DECIDED
//     → (novel) create LearningCandidate (PENDING — Rule 9 §97)
//     → (duplicate / low-novelty) skip candidate creation
//
// §75 — NO automatic cross-platform memory leakage.
// §97 — candidates are NEVER auto-promoted.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildTermVector, cosineSimilarity } from "@/lib/brain/vectors";
import { createLearningCandidate } from "@/lib/brain/learning";
import {
  contentHash,
  categoryForEventType,
  exceedsCeiling,
  DUPLICATE_SIMILARITY,
  NOVELTY_THRESHOLD,
  RECENT_EVENT_WINDOW,
} from "@/lib/brain/event-bus";
import type { BrainPlatformEvent, PlatformEventPipelineState } from "@/lib/brain/types";

// Payload type for a PlatformEvent with its platform relation included.
export type PlatformEventWithPlatform = Prisma.PlatformEventGetPayload<{
  include: { platform: true };
}>;

export interface ProcessResult {
  eventId: string;
  finalState: PlatformEventPipelineState | string;
  novelty?: number;
  duplicate?: boolean;
  candidateId?: string;
  candidateCategory?: string;
  rejected?: boolean;
  reason?: string;
}

export interface ProcessPendingOpts {
  /** Max events to advance in one invocation (capped at 200). Default 50. */
  limit?: number;
  /** Restrict to a single platform (used by platform-scoped workers). */
  platformId?: string;
}

/**
 * Advance a batch of RECEIVED events through the §21 pipeline (FIFO — oldest
 * first). Returns one ProcessResult per event. Errors on individual events
 * do not abort the batch — the event is flagged with a `pipelineError` and
 * left in RECEIVED state for the next pass.
 */
export async function processPendingEvents(
  opts: ProcessPendingOpts = {},
): Promise<ProcessResult[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const platformId = opts.platformId;

  const pending: PlatformEventWithPlatform[] = await db.platformEvent.findMany({
    where: {
      pipelineState: "RECEIVED",
      ...(platformId ? { platformId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { platform: true },
  });

  const results: ProcessResult[] = [];
  for (const ev of pending) {
    try {
      results.push(await advancePipeline(ev));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Mark the event with a pipeline error but keep moving.
      await db.platformEvent
        .update({
          where: { id: ev.id },
          data: { pipelineError: `process error: ${msg}` },
        })
        .catch(() => undefined);
      results.push({ eventId: ev.eventId, finalState: "RECEIVED", reason: msg });
    }
  }
  return results;
}

/** Advance one event from RECEIVED → ... → PROMOTION_DECIDED (or REJECTED). */
export async function advancePipeline(ev: PlatformEventWithPlatform): Promise<ProcessResult> {
  const platform = ev.platform;
  const data = safeJson(ev.data) as Record<string, unknown>;

  // Reconstruct a partial BrainPlatformEvent view for hashing + candidate generation.
  const eventView: BrainPlatformEvent = {
    eventId: ev.eventId,
    eventType: ev.eventType,
    eventVersion: ev.eventVersion,
    timestamp: ev.createdAt.toISOString(),
    platformId: ev.platformId,
    applicationId: ev.applicationId ?? undefined,
    tenantId: ev.tenantId,
    userId: ev.userId ?? undefined,
    requestId: ev.requestId ?? undefined,
    actor:
      ev.actorType && ev.actorId
        ? { type: ev.actorType as "user" | "agent" | "service" | "system" | "adapter", id: ev.actorId }
        : undefined,
    data,
  };

  // ----- 1. CLASSIFIED -----
  const platformCeiling = platform.dataClassCeiling;
  const eventClassification = ev.classification || "INTERNAL";
  const effectiveScope = ev.scope || platform.memoryScope || "APPLICATION";

  await db.platformEvent.update({
    where: { id: ev.id },
    data: {
      classification: eventClassification,
      scope: effectiveScope,
      pipelineState: "CLASSIFIED",
    },
  });

  // ----- 2. SECURITY_CHECKED -----
  if (exceedsCeiling(eventClassification, platformCeiling)) {
    await db.platformEvent.update({
      where: { id: ev.id },
      data: {
        pipelineState: "REJECTED",
        pipelineError: `classification ${eventClassification} exceeds platform ceiling ${platformCeiling} (§24, §60)`,
        processedAt: new Date(),
      },
    });
    await db.auditEvent.create({
      data: {
        tenantId: ev.tenantId,
        requestId: ev.requestId ?? null,
        actorType: "system",
        actorId: "brain.events.process",
        action: "platform.event.rejected",
        target: ev.eventId,
        reason: `classification ${eventClassification} exceeds ceiling ${platformCeiling} for platform ${platform.slug}`,
        severity: "WARN",
      },
    });
    return {
      eventId: ev.eventId,
      finalState: "REJECTED",
      rejected: true,
      reason: `classification exceeds ceiling`,
    };
  }

  await db.platformEvent.update({
    where: { id: ev.id },
    data: { pipelineState: "SECURITY_CHECKED" },
  });

  // ----- 3. PROVENANCE_ATTACHED -----
  let provenance = safeJson(ev.provenance) as Record<string, unknown> | null;
  if (!provenance) {
    provenance = {
      sourceApp: platform.slug,
      retrievedAt: ev.createdAt.toISOString(),
      extractionMethod: "platform-event-bus",
    };
    await db.platformEvent.update({
      where: { id: ev.id },
      data: {
        provenance: JSON.stringify(provenance),
        pipelineState: "PROVENANCE_ATTACHED",
      },
    });
  } else {
    await db.platformEvent.update({
      where: { id: ev.id },
      data: { pipelineState: "PROVENANCE_ATTACHED" },
    });
  }

  // ----- 4. DUPLICATE_CHECKED -----
  const hash = contentHash(eventView);
  const recentSameType = await db.platformEvent.findMany({
    where: {
      eventType: ev.eventType,
      id: { not: ev.id },
    },
    orderBy: { createdAt: "desc" },
    take: RECENT_EVENT_WINDOW,
  });

  let maxSim = 0;
  let exactHashMatch = false;
  for (const other of recentSameType) {
    const otherView: BrainPlatformEvent = {
      eventId: other.eventId,
      eventType: other.eventType,
      eventVersion: other.eventVersion,
      timestamp: other.createdAt.toISOString(),
      data: safeJson(other.data) as Record<string, unknown>,
      actor:
        other.actorType && other.actorId
          ? { type: other.actorType as "user" | "agent" | "service" | "system" | "adapter", id: other.actorId }
          : undefined,
    };
    if (contentHash(otherView) === hash) {
      exactHashMatch = true;
      maxSim = 1;
      break;
    }
    const sim = cosineSimilarity(
      buildTermVector(JSON.stringify(eventView.data)),
      buildTermVector(JSON.stringify(otherView.data)),
    );
    if (sim > maxSim) maxSim = sim;
  }

  const isDuplicate = exactHashMatch || maxSim >= DUPLICATE_SIMILARITY;
  await db.platformEvent.update({
    where: { id: ev.id },
    data: { pipelineState: "DUPLICATE_CHECKED" },
  });

  // ----- 5. NOVELTY_SCORED -----
  const novelty = Math.max(0, 1 - maxSim);
  await db.platformEvent.update({
    where: { id: ev.id },
    data: { pipelineState: "NOVELTY_SCORED" },
  });

  // ----- 6. PROMOTION_DECIDED -----
  if (isDuplicate || novelty < NOVELTY_THRESHOLD) {
    await db.platformEvent.update({
      where: { id: ev.id },
      data: {
        pipelineState: "PROMOTION_DECIDED",
        pipelineError: isDuplicate
          ? "duplicate event (§69, §21)"
          : `low novelty (${novelty.toFixed(3)})`,
        processedAt: new Date(),
      },
    });
    return {
      eventId: ev.eventId,
      finalState: "PROMOTION_DECIDED",
      novelty,
      duplicate: isDuplicate,
    };
  }

  const category = categoryForEventType(ev.eventType);
  const candidate = await createLearningCandidate({
    tenantId: ev.tenantId,
    runId: ev.requestId ?? undefined,
    category,
    proposed: {
      eventId: ev.eventId,
      eventType: ev.eventType,
      platformSlug: platform.slug,
      platformDomain: platform.domain,
      scope: effectiveScope,
      classification: eventClassification,
      data,
      provenance,
      source: "platform-event-bus",
    },
    evidence: {
      noveltyScore: novelty,
      contentHash: hash,
      processedAt: new Date().toISOString(),
    },
  });

  await db.platformEvent.update({
    where: { id: ev.id },
    data: {
      pipelineState: "PROMOTION_DECIDED",
      processedAt: new Date(),
    },
  });

  await db.auditEvent.create({
    data: {
      tenantId: ev.tenantId,
      requestId: ev.requestId ?? null,
      actorType: "system",
      actorId: "brain.events.process",
      action: "learning.candidate.created",
      target: candidate.id,
      reason: `platform event ${ev.eventId} (${ev.eventType}) → candidate (category=${category}, novelty=${novelty.toFixed(3)}). PENDING review — never auto-promoted (Rule 9, §97).`,
      severity: "INFO",
    },
  });

  return {
    eventId: ev.eventId,
    finalState: "PROMOTION_DECIDED",
    novelty,
    duplicate: false,
    candidateId: candidate.id,
    candidateCategory: category,
  };
}

function safeJson(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
