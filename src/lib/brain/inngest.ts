// WEDJAT BRAIN V2 — Inngest background functions (spec §65).
//
// Inngest is the durable-execution layer for the Brain's background work:
//   - memory consolidation (§22, §24 decay, §23 promotion rules)
//   - cross-platform event pipeline (§21 — driven by `brain/event.received`)
//   - knowledge refresh (§33 — refreshSchedule validity windows)
//   - evaluation batch (§86-92 golden suite, runs offline)
//   - human-approval wait (§56 high-risk tool gating, 24h SLA)
//
// All five functions use `step.run` for deterministic, replayable side-effects
// and `step.waitForEvent` / `step.sleep` for human-in-the-loop gating. Each
// function body is wrapped in try/catch and uses `NonRetriableError` for
// permanent failures (no point retrying a malformed payload) while transient
// failures fall through to Inngest's default exponential backoff (retries: 5).
//
// The actual business logic lives in `@/lib/brain/jobs.ts` so the dev-only
// REST endpoint /api/brain/jobs can call the SAME code paths without a
// running Inngest worker.
//
// NEVER import z-ai-web-dev-sdk here. LLM calls happen via the runtime
// (lazily imported by jobs.ts); Inngest functions orchestrate persistence,
// scheduling, and human approval only.
//
// In production these are invoked by the Inngest worker via the
// /api/inngest serve handler. In dev (no Inngest dev server available in
// this sandbox) use POST /api/brain/jobs to run them directly.

import { Inngest, NonRetriableError } from "inngest";
import { db } from "@/lib/db";
import {
  runMemoryConsolidation,
  runEventPipeline,
  runKnowledgeRefresh,
  runEvaluationBatch,
} from "@/lib/brain/jobs";

// ---------------------------------------------------------------
// Client
// ---------------------------------------------------------------

/**
 * The Brain's Inngest client. `eventKey` defaults to `"dev-key"` for local
 * development; set `INNGEST_EVENT_KEY` in production. The Brain ID is a
 * stable application identifier used by the Inngest dashboard.
 */
export const inngest = new Inngest({
  id: "cirkle-brain-ai",
  eventKey: process.env.INNGEST_EVENT_KEY ?? "dev-key",
});

/** 5 retries with Inngest's default exponential backoff (~starting 1s, ×2). */
const BRAIN_RETRIES = 5 as const;

// ---------------------------------------------------------------
// 1. brain-memory-consolidation (cron */10 * * * *)
// ---------------------------------------------------------------

const MEMORY_CONSOLIDATION_FN_ID = "brain-memory-consolidation";

export const brainMemoryConsolidation = inngest.createFunction(
  {
    id: MEMORY_CONSOLIDATION_FN_ID,
    name: "Brain — Memory Consolidation (§22, §24)",
    retries: BRAIN_RETRIES,
    triggers: [{ cron: "*/10 * * * *" }],
  },
  async ({ step, logger }) => {
    return await step.run("consolidate-memories", async () => {
      try {
        const result = await runMemoryConsolidation();
        logger.info(
          `[brain-memory-consolidation] scanned=${result.scanned} rejected=${result.rejected} kept_for_review=${result.keptForReview}`,
        );
        return result;
      } catch (err) {
        // Permanent error — bad config / schema mismatch. Don't retry blindly.
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[brain-memory-consolidation] fatal: ${msg}`);
        throw new NonRetriableError(`memory consolidation failed: ${msg}`, { cause: err });
      }
    });
  },
);

// ---------------------------------------------------------------
// 2. brain-event-pipeline (event brain/event.received)
// ---------------------------------------------------------------

const EVENT_PIPELINE_FN_ID = "brain-event-pipeline";

export const brainEventPipeline = inngest.createFunction(
  {
    id: EVENT_PIPELINE_FN_ID,
    name: "Brain — Cross-platform Event Pipeline (§21)",
    retries: BRAIN_RETRIES,
    triggers: [{ event: "brain/event.received" }],
  },
  async ({ event, step, logger }) => {
    const triggerEventId =
      (event.data as { eventId?: string } | undefined)?.eventId ?? "unknown";

    return await step.run("advance-pipeline", async () => {
      try {
        const data = (event.data ?? {}) as { limit?: number; platformId?: string };
        const result = await runEventPipeline({
          triggerEventId,
          limit: data.limit,
          platformId: data.platformId,
        });
        logger.info(
          `[brain-event-pipeline] trigger=${triggerEventId} processed=${result.processed} candidates=${result.promotedCandidates} rejected=${result.rejected}`,
        );
        return result;
      } catch (err) {
        // Distinguish permanent vs transient. Prisma connection errors and
        // timeouts should retry; schema/validation errors should not.
        const msg = err instanceof Error ? err.message : String(err);
        const isPermanent =
          /unknown field|invalid.*prisma|does not exist|validation/i.test(msg);
        logger.error(`[brain-event-pipeline] error: ${msg}`);
        if (isPermanent) {
          throw new NonRetriableError(`event pipeline permanent failure: ${msg}`, { cause: err });
        }
        // Transient — let Inngest retry with backoff (retries: 5).
        throw err;
      }
    });
  },
);

// ---------------------------------------------------------------
// 3. brain-knowledge-refresh (cron "0 3 * * *")
// ---------------------------------------------------------------

const KNOWLEDGE_REFRESH_FN_ID = "brain-knowledge-refresh";

export const brainKnowledgeRefresh = inngest.createFunction(
  {
    id: KNOWLEDGE_REFRESH_FN_ID,
    name: "Brain — Knowledge Refresh (§33)",
    retries: BRAIN_RETRIES,
    triggers: [{ cron: "0 3 * * *" }],
  },
  async ({ step, logger }) => {
    return await step.run("refresh-scheduled-knowledge", async () => {
      try {
        const result = await runKnowledgeRefresh();
        logger.info(
          `[brain-knowledge-refresh] scanned=${result.scanned} queued_for_refresh=${result.queuedForRefresh}`,
        );
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[brain-knowledge-refresh] fatal: ${msg}`);
        throw new NonRetriableError(`knowledge refresh failed: ${msg}`, { cause: err });
      }
    });
  },
);

// ---------------------------------------------------------------
// 4. brain-evaluation-batch (event brain/evaluation.requested)
// ---------------------------------------------------------------

const EVALUATION_BATCH_FN_ID = "brain-evaluation-batch";

export const brainEvaluationBatch = inngest.createFunction(
  {
    id: EVALUATION_BATCH_FN_ID,
    name: "Brain — Evaluation Batch (§86-92)",
    retries: BRAIN_RETRIES,
    triggers: [{ event: "brain/evaluation.requested" }],
  },
  async ({ event, step, logger }) => {
    const trigger = (event.data ?? {}) as {
      setId?: string;
      tenantId?: string;
      applicationId?: string;
      userId?: string;
      triggeredBy?: string;
    };

    const result = await step.run("run-golden-suite", async () => {
      try {
        return await runEvaluationBatch({
          setId: trigger.setId,
          tenantId: trigger.tenantId,
          applicationId: trigger.applicationId,
          userId: trigger.userId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[brain-evaluation-batch] failed: ${msg}`);
        // Set-not-found + missing-tenant are permanent; transient DB errors retry.
        const isPermanent = /not found|no tenants|no application/i.test(msg);
        if (isPermanent) {
          throw new NonRetriableError(`evaluation batch permanent failure: ${msg}`, { cause: err });
        }
        throw err;
      }
    });

    // Emit brain/evaluation.completed so downstream listeners can react.
    // Uses step.sendEvent (durable — replayable) rather than a fire-and-forget
    // events.send so the emit survives retries.
    await step.sendEvent("emit-evaluation-completed", {
      name: "brain/evaluation.completed",
      data: {
        runId: result.runId,
        setId: result.setId,
        total: result.total,
        pass: result.pass,
        fail: result.fail,
        passRate: result.passRate,
        triggeredBy: trigger.triggeredBy ?? "inngest",
        completedAt: new Date().toISOString(),
      },
    });

    return result;
  },
);

// ---------------------------------------------------------------
// 5. brain-human-approval-wait (event brain/approval.required)
// ---------------------------------------------------------------

const HUMAN_APPROVAL_FN_ID = "brain-human-approval-wait";

export const brainHumanApprovalWait = inngest.createFunction(
  {
    id: HUMAN_APPROVAL_FN_ID,
    name: "Brain — Human Approval Wait (§56)",
    retries: BRAIN_RETRIES,
    triggers: [{ event: "brain/approval.required" }],
  },
  async ({ event, step, logger }) => {
    const trigger = (event.data ?? {}) as {
      executionId: string;
      tenantId?: string;
      toolId?: string;
      riskLevel?: string;
      requestId?: string;
    };

    if (!trigger.executionId) {
      // Permanent — no point retrying without a target execution.
      throw new NonRetriableError("brain/approval.required missing 'executionId'");
    }

    // Wait up to 24h for the matching approval event. Inngest matches on
    // the `executionId` property in the incoming event's data.
    const approval = await step.waitForEvent("await-approval", {
      event: "brain/approval.received",
      timeout: "24h",
      if: `event.data.executionId == "${trigger.executionId}"`,
    });

    return await step.run("resolve-approval", async () => {
      try {
        const execution = await db.toolExecution.findUnique({
          where: { id: trigger.executionId },
        });
        if (!execution) {
          throw new NonRetriableError(
            `tool execution ${trigger.executionId} not found`,
          );
        }

        // If already in a terminal state, do nothing (idempotency — §54).
        const terminal = new Set([
          "EXECUTED",
          "VERIFIED",
          "REJECTED",
          "FAILED",
          "TIMED_OUT",
          "CANCELLED",
        ]);
        if (terminal.has(execution.state)) {
          return { executionId: execution.id, state: execution.state, action: "already-terminal" };
        }

        if (approval) {
          // Approved — advance to AUTHORIZED. The runtime's tool-execution
          // worker will resume and complete the tool call.
          const approver =
            (approval.data as { approver?: string } | undefined)?.approver ?? "unknown";
          await db.toolExecution.update({
            where: { id: execution.id },
            data: {
              state: "AUTHORIZED",
              approver,
              approvedAt: new Date(),
            },
          });
          await db.auditEvent.create({
            data: {
              tenantId: execution.tenantId,
              requestId: execution.runId ?? null,
              actorType: "user",
              actorId: approver,
              action: "tool.approved",
              target: execution.id,
              reason: `human approval received via brain/approval.received (§56)`,
              severity: "INFO",
            },
          });
          logger.info(`[brain-human-approval-wait] execution ${execution.id} APPROVED by ${approver}`);
          return { executionId: execution.id, state: "AUTHORIZED", action: "approved", approver };
        }

        // Timed out — §55: mark TIMED_OUT.
        await db.toolExecution.update({
          where: { id: execution.id },
          data: {
            state: "TIMED_OUT",
            error: "human approval timed out after 24h (§56)",
          },
        });
        await db.auditEvent.create({
          data: {
            tenantId: execution.tenantId,
            requestId: execution.runId ?? null,
            actorType: "system",
            actorId: "brain.human-approval-wait",
            action: "tool.timed_out",
            target: execution.id,
            reason: `no human approval received within 24h (§56) — execution TIMED_OUT`,
            severity: "WARN",
          },
        });
        logger.warn(`[brain-human-approval-wait] execution ${execution.id} TIMED OUT`);
        return { executionId: execution.id, state: "TIMED_OUT", action: "timed-out" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[brain-human-approval-wait] resolve-approval failed: ${msg}`);
        if (err instanceof NonRetriableError) throw err;
        throw err;
      }
    });
  },
);

// ---------------------------------------------------------------
// Exports
// ---------------------------------------------------------------

/**
 * All Brain Inngest functions, registered for the serve handler at
 * /api/inngest. Also used by /api/brain/jobs (dev-only direct invocation).
 */
export const brainFunctions = [
  brainMemoryConsolidation,
  brainEventPipeline,
  brainKnowledgeRefresh,
  brainEvaluationBatch,
  brainHumanApprovalWait,
];

// Re-export NonRetriableError for callers that build their own Brain functions.
export { NonRetriableError };
