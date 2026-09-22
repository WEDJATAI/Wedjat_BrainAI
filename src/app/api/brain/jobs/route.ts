// POST /api/brain/jobs — DEV-ONLY manual trigger for Brain background jobs (§65).
//
// In production these run via the Inngest worker (POST /api/inngest). This
// endpoint exists so the background pipeline can be exercised in this
// sandbox WITHOUT a running Inngest dev server.
//
// Each job delegates to the SAME business logic (`@/lib/brain/jobs.ts`) that
// the corresponding Inngest function calls inside `step.run`. So results are
// identical to what Inngest would produce (minus the durable-execution
// guarantees).
//
// Body: { job: "memory-consolidation" | "event-pipeline" | "knowledge-refresh" | "evaluation-batch", ...opts }
//
// Returns: 200 { ok, job, result } on success
//          400 { error } for unknown job name or invalid options
//          500 { ok:false, error } for transient failures
//
// NOTE: brain-human-approval-wait is intentionally NOT exposed here — it
// requires the Inngest `step.waitForEvent` primitive (24h durable wait) which
// has no equivalent outside Inngest. Approval flows are tested via
// POST /api/brain/tools/approve (synchronous human approval).

import { NextRequest, NextResponse } from "next/server";
import {
  runMemoryConsolidation,
  runEventPipeline,
  runKnowledgeRefresh,
  runEvaluationBatch,
} from "@/lib/brain/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type BrainJobName =
  | "memory-consolidation"
  | "event-pipeline"
  | "knowledge-refresh"
  | "evaluation-batch";

interface JobsRequestBody {
  job: BrainJobName;
  // Optional per-job parameters:
  limit?: number;        // event-pipeline: max events to process (capped 200)
  platformId?: string;   // event-pipeline: restrict to one platform
  setId?: string;        // evaluation-batch: golden set id
  tenantId?: string;     // evaluation-batch: identity override
  applicationId?: string;// evaluation-batch: identity override
  userId?: string;       // evaluation-batch: identity override
}

export async function POST(req: NextRequest) {
  let body: JobsRequestBody;
  try {
    body = (await req.json()) as JobsRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const job = body.job;
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "missing required field: job" },
      { status: 400 },
    );
  }

  try {
    switch (job) {
      case "memory-consolidation": {
        const result = await runMemoryConsolidation();
        return NextResponse.json({ ok: true, job, result });
      }
      case "event-pipeline": {
        const result = await runEventPipeline({
          triggerEventId: "dev-manual",
          limit: body.limit,
          platformId: body.platformId,
        });
        return NextResponse.json({ ok: true, job, result });
      }
      case "knowledge-refresh": {
        const result = await runKnowledgeRefresh();
        return NextResponse.json({ ok: true, job, result });
      }
      case "evaluation-batch": {
        const result = await runEvaluationBatch({
          setId: body.setId,
          tenantId: body.tenantId,
          applicationId: body.applicationId,
          userId: body.userId,
        });
        return NextResponse.json({ ok: true, job, result });
      }
      default: {
        // Exhaustiveness check — if BrainJobName gains a member, TS flags this.
        const _exhaustive: never = job;
        return NextResponse.json(
          { ok: false, error: `unknown job: ${_exhaustive as string}` },
          { status: 400 },
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, job, error: msg },
      { status: 500 },
    );
  }
}

// GET — list available jobs (dev discoverability).
export async function GET() {
  return NextResponse.json({
    ok: true,
    jobs: [
      {
        job: "memory-consolidation",
        description:
          "Scan CANDIDATE memories older than 5 min; reject low-novelty duplicates (§22, §24). Runs in production every 10 min via Inngest.",
      },
      {
        job: "event-pipeline",
        description:
          "Advance RECEIVED cross-platform events through the §21 pipeline. Options: limit, platformId.",
      },
      {
        job: "knowledge-refresh",
        description:
          "Mark stale (hourly/daily) ACTIVE KnowledgeItems VALIDATING + emit audit (§33). Runs daily at 03:00 via Inngest.",
      },
      {
        job: "evaluation-batch",
        description:
          "Run the golden evaluation suite (§86-92). Options: setId, tenantId, applicationId, userId.",
      },
    ],
    note: "In production these run via the Inngest worker (POST /api/inngest). This dev endpoint lets you exercise them without a running worker.",
  });
}
