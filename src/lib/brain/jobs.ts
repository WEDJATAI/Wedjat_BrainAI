// WEDJAT BRAIN V2 — Shared background-job business logic (spec §65).
//
// Each Brain background function (memory consolidation, event pipeline,
// knowledge refresh, evaluation batch) has its actual side-effecting work
// extracted here so that BOTH callers share one implementation:
//
//   1. The Inngest function (src/lib/brain/inngest.ts) wraps each in
//      `step.run(...)` for durable checkpointing.
//   2. The dev-only REST endpoint (POST /api/brain/jobs) calls them
//      directly so the background pipeline can be exercised without a
//      running Inngest worker.
//
// In production: these are invoked by the Inngest worker.
// NEVER import z-ai-web-dev-sdk here. The eval batch lazily imports the
// Brain runtime (which owns the LLM) — keeping the static module graph
// free of AI SDKs.

import { db } from "@/lib/db";
import { buildTermVector, cosineSimilarity, deserializeVector } from "@/lib/brain/vectors";
import { processPendingEvents } from "@/lib/brain/event-pipeline";

// ---------------------------------------------------------------
// 1. Memory consolidation (§22, §24, §97 Rule 9)
// ---------------------------------------------------------------

export interface MemoryConsolidationResult {
  scanned: number;
  rejected: number;
  keptForReview: number;
  rejectedIds: string[];
  keptForReviewIds: string[];
}

/**
 * Find CANDIDATE memories older than 5 minutes. For each, compute novelty
 * against existing ACTIVE memories in the same domain+scope+tenant.
 *
 * - Low novelty (≤ 0.3) → mark REJECTED (duplicate / already-known, §24 decay).
 * - High novelty (> 0.3) → leave as CANDIDATE for explicit human review
 *   (Rule 9 §97 — never auto-promote).
 */
export async function runMemoryConsolidation(): Promise<MemoryConsolidationResult> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago

  const candidates = await db.memoryItem.findMany({
    where: {
      status: "CANDIDATE",
      createdAt: { lt: cutoff },
    },
    take: 200,
  });

  const rejected: string[] = [];
  const keptForReview: string[] = [];

  for (const m of candidates) {
    const activePeers = await db.memoryItem.findMany({
      where: {
        tenantId: m.tenantId,
        applicationId: m.applicationId,
        domain: m.domain,
        status: "ACTIVE",
      },
      take: 100,
    });

    let maxSim = 0;
    const candVec = deserializeVector(m.contentVector) ?? buildTermVector(m.content);
    for (const peer of activePeers) {
      const peerVec = deserializeVector(peer.contentVector) ?? buildTermVector(peer.content);
      const sim = cosineSimilarity(candVec, peerVec);
      if (sim > maxSim) maxSim = sim;
    }
    const novelty = Math.max(0, 1 - maxSim);

    if (novelty <= 0.3) {
      await db.memoryItem.update({
        where: { id: m.id },
        data: { status: "REJECTED" },
      });
      await db.auditEvent.create({
        data: {
          tenantId: m.tenantId,
          actorType: "system",
          actorId: "brain.memory.consolidation",
          action: "memory.rejected",
          target: m.id,
          reason: `low novelty (${novelty.toFixed(3)}) — duplicates existing ACTIVE memory (§24 decay, §22)`,
          severity: "INFO",
        },
      });
      rejected.push(m.id);
    } else {
      // High novelty — leave as CANDIDATE for human review (Rule 9 §97).
      keptForReview.push(m.id);
    }
  }

  return {
    scanned: candidates.length,
    rejected: rejected.length,
    keptForReview: keptForReview.length,
    rejectedIds: rejected,
    keptForReviewIds: keptForReview,
  };
}

// ---------------------------------------------------------------
// 2. Event pipeline (§21, §94-97)
// ---------------------------------------------------------------

export interface EventPipelineResult {
  triggerEventId: string;
  processed: number;
  promotedCandidates: number;
  rejected: number;
  results: Awaited<ReturnType<typeof processPendingEvents>>;
}

/** Advance RECEIVED cross-platform events through the §21 pipeline. */
export async function runEventPipeline(opts: {
  triggerEventId?: string;
  limit?: number;
  platformId?: string;
} = {}): Promise<EventPipelineResult> {
  const limit = Math.min(Number(opts.limit ?? 50), 200);
  const results = await processPendingEvents({ limit, platformId: opts.platformId });
  return {
    triggerEventId: opts.triggerEventId ?? "manual",
    processed: results.length,
    promotedCandidates: results.filter((r) => !!r.candidateId).length,
    rejected: results.filter((r) => !!r.rejected).length,
    results,
  };
}

// ---------------------------------------------------------------
// 3. Knowledge refresh (§33)
// ---------------------------------------------------------------

export interface KnowledgeRefreshResult {
  scanned: number;
  queuedForRefresh: number;
  itemIds: string[];
}

/**
 * Find ACTIVE KnowledgeItems with refreshSchedule ∈ {hourly, daily} whose
 * lastRefreshedAt is older than the schedule window; mark VALIDATING + emit
 * audit. STUB — actual external-source refresh is performed by platform
 * adapters (src/lib/brain/adapters/*).
 */
export async function runKnowledgeRefresh(): Promise<KnowledgeRefreshResult> {
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  const candidates = await db.knowledgeItem.findMany({
    where: {
      status: "ACTIVE",
      refreshSchedule: { in: ["hourly", "daily"] },
    },
    take: 500,
  });

  const toRefresh: { id: string; reason: string; tenantId: string }[] = [];
  for (const k of candidates) {
    const last = k.lastRefreshedAt?.getTime() ?? k.updatedAt.getTime();
    const age = now - last;
    if (k.refreshSchedule === "hourly" && age >= HOUR_MS) {
      toRefresh.push({ id: k.id, reason: `hourly: age ${Math.round(age / HOUR_MS)}h`, tenantId: k.tenantId });
    } else if (k.refreshSchedule === "daily" && age >= DAY_MS) {
      toRefresh.push({ id: k.id, reason: `daily: age ${Math.round(age / DAY_MS)}d`, tenantId: k.tenantId });
    }
  }

  for (const r of toRefresh) {
    await db.knowledgeItem.update({
      where: { id: r.id },
      data: { status: "VALIDATING" },
    });
    await db.auditEvent.create({
      data: {
        tenantId: r.tenantId,
        actorType: "system",
        actorId: "brain.knowledge.refresh",
        action: "knowledge.refresh.scheduled",
        target: r.id,
        reason: r.reason,
        severity: "INFO",
      },
    });
  }

  return {
    scanned: candidates.length,
    queuedForRefresh: toRefresh.length,
    itemIds: toRefresh.map((r) => r.id),
  };
}

// ---------------------------------------------------------------
// 4. Evaluation batch (§86-92)
// ---------------------------------------------------------------

export interface EvaluationBatchResult {
  runId: string;
  setId: string;
  total: number;
  pass: number;
  fail: number;
  passRate: number;
  caseResults: Array<{
    caseId: string;
    input: string;
    expected: string;
    got: string;
    passed: boolean;
    latencyMs: number;
    costUsd: number;
    evidenceStatus?: string;
  }>;
}

/**
 * Run the golden evaluation suite. Reuses the runtime's runBrain() for each
 * case. Persists an EvaluationRun record. (The Inngest function additionally
 * emits a `brain/evaluation.completed` event after this returns.)
 */
export async function runEvaluationBatch(opts: {
  setId?: string;
  tenantId?: string;
  applicationId?: string;
  userId?: string;
} = {}): Promise<EvaluationBatchResult> {
  const setId = opts.setId ?? "golden-baseline";

  const set = await db.evaluationSet.findUnique({
    where: { id: setId },
    include: { cases: true },
  });
  if (!set) throw new Error(`evaluation set '${setId}' not found`);

  // Resolve identity defaults (mirror /api/brain/evaluate).
  let tenantId = opts.tenantId;
  if (!tenantId) {
    const t = (await db.tenant.findUnique({ where: { slug: "acme" } })) ?? (await db.tenant.findFirst());
    if (!t) throw new Error("no tenants exist in the DB");
    tenantId = t.id;
  }
  let applicationId = opts.applicationId;
  if (!applicationId) {
    const a = await db.application.findFirst({ where: { tenantId } });
    if (!a) throw new Error(`no application found for tenant ${tenantId}`);
    applicationId = a.id;
  }
  let userId = opts.userId;
  if (!userId) {
    const u = await db.user.findFirst({ where: { tenantId } });
    userId = u?.id;
  }

  const run = await db.evaluationRun.create({
    data: { setId, status: "RUNNING", startedAt: new Date() },
  });

  // Lazily import runBrain — keep z-ai-web-dev-sdk out of this module's
  // static graph. The runtime owns the LLM; this module only orchestrates.
  const { runBrain } = await import("@/lib/brain/runtime");
  const { randomUUID } = await import("node:crypto");

  const caseResults: EvaluationBatchResult["caseResults"] = [];
  let pass = 0;
  for (const c of set.cases) {
    const start = Date.now();
    const r = await runBrain({
      requestId: `eval-${randomUUID()}`,
      tenantId,
      applicationId,
      userId,
      input: { text: c.input },
      mode: "auto",
      permissions: { scopes: ["brain:respond"] },
    }).catch((err: unknown) => ({
      answer: `error: ${err instanceof Error ? err.message : String(err)}`,
      quality: { evidenceStatus: "UNSUPPORTED" as const },
      cost: { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - start },
    }));
    const got = r.answer;
    const expected = c.expected ?? "";
    const passed = passedCheck(got, expected);
    if (passed) pass++;
    caseResults.push({
      caseId: c.id,
      input: c.input,
      expected,
      got,
      passed,
      latencyMs: r.cost?.latencyMs ?? 0,
      costUsd: r.cost?.costUsd ?? 0,
      evidenceStatus: r.quality?.evidenceStatus,
    });
  }

  await db.evaluationRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      results: JSON.stringify({
        pass,
        fail: set.cases.length - pass,
        total: set.cases.length,
        results: caseResults,
      }),
    },
  });

  return {
    runId: run.id,
    setId,
    total: set.cases.length,
    pass,
    fail: set.cases.length - pass,
    passRate: set.cases.length ? pass / set.cases.length : 0,
    caseResults,
  };
}

function passedCheck(got: string, expected: string): boolean {
  const g = got.toLowerCase();
  const e = expected.toLowerCase().trim();
  if (!e) return true;
  // expected can be a comma-separated list of substrings — all must appear
  return e
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .every((s) => g.includes(s));
}
