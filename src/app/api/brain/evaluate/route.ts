// POST /api/brain/evaluate — run evaluation against golden dataset (§86-92).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { runBrain } from "@/lib/brain/runtime";
import type { BrainRequest } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { setId?: string; tenantId?: string; applicationId?: string; userId?: string };
  const setId = body.setId ?? "golden-baseline";

  const set = await db.evaluationSet.findUnique({ where: { id: setId }, include: { cases: true } });
  if (!set) return NextResponse.json({ error: "evaluation set not found" }, { status: 404 });

  // Resolve identity defaults
  let tenantId = body.tenantId;
  let applicationId = body.applicationId;
  let userId = body.userId;
  if (!tenantId) {
    const t = await db.tenant.findUnique({ where: { slug: "acme" } }) ?? (await db.tenant.findFirst())!;
    tenantId = t.id;
  }
  if (!applicationId) {
    const a = await db.application.findFirst({ where: { tenantId } });
    applicationId = a!.id;
  }
  if (!userId) {
    const u = await db.user.findFirst({ where: { tenantId } });
    userId = u?.id;
  }

  const run = await db.evaluationRun.create({
    data: { setId, status: "RUNNING", startedAt: new Date() },
  });

  const results: Array<{ caseId: string; input: string; expected: string; got: string; passed: boolean; latencyMs: number; costUsd: number; evidenceStatus?: string }> = [];
  let pass = 0;
  for (const c of set.cases) {
    const req: BrainRequest = {
      requestId: `eval-${randomUUID()}`,
      tenantId, applicationId, userId,
      input: { text: c.input },
      mode: "auto",
      permissions: { scopes: ["brain:respond"] },
    };
    const start = Date.now();
    const r = await runBrain(req).catch((err) => ({ answer: `error: ${err?.message}`, quality: { evidenceStatus: "UNSUPPORTED" }, cost: { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - start } }));
    const got = r.answer;
    const expected = c.expected ?? "";
    const passed = passedCheck(got, expected);
    if (passed) pass++;
    results.push({
      caseId: c.id, input: c.input, expected, got, passed,
      latencyMs: r.cost?.latencyMs ?? 0, costUsd: r.cost?.costUsd ?? 0,
      evidenceStatus: r.quality?.evidenceStatus,
    });
  }

  await db.evaluationRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", completedAt: new Date(), results: JSON.stringify({ pass, fail: set.cases.length - pass, total: set.cases.length, results }) },
  });

  return NextResponse.json({
    setId, runId: run.id,
    total: set.cases.length, pass, fail: set.cases.length - pass,
    passRate: set.cases.length ? pass / set.cases.length : 0,
    results,
  });
}

function passedCheck(got: string, expected: string): boolean {
  const g = got.toLowerCase();
  const e = expected.toLowerCase().trim();
  if (!e) return true;
  // expected can be a comma-separated list of substrings — all must appear
  return e.split(",").map((s) => s.trim()).filter(Boolean).every((s) => g.includes(s));
}
