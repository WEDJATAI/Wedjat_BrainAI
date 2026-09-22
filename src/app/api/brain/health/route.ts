// GET /api/brain/health — Brain self-diagnostics (§110, §198).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listModels } from "@/lib/brain/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }> = {};

  // DB health
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - t0 };
  } catch (err: any) {
    checks.database = { ok: false, detail: err?.message };
  }

  // Model availability (§110)
  try {
    const models = await listModels();
    checks.models = { ok: models.length > 0, detail: `${models.length} active model(s): ${models.map((m) => m.displayName).join(", ")}` };
  } catch (err: any) {
    checks.models = { ok: false, detail: err?.message };
  }

  // Retrieval health
  try {
    const knowledge = await db.knowledgeItem.count({ where: { status: "ACTIVE" } });
    const memory = await db.memoryItem.count({ where: { status: "ACTIVE" } });
    checks.retrieval = { ok: true, detail: `${knowledge} knowledge items, ${memory} memories` };
  } catch (err: any) {
    checks.retrieval = { ok: false, detail: err?.message };
  }

  // Tool health
  try {
    const tools = await db.tool.count({ where: { status: "ACTIVE" } });
    checks.tools = { ok: tools > 0, detail: `${tools} active tools` };
  } catch (err: any) {
    checks.tools = { ok: false, detail: err?.message };
  }

  // Audit backlog
  try {
    const recent = await db.auditEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    checks.audit = { ok: true, detail: `${recent} audit events in last 24h` };
  } catch (err: any) {
    checks.audit = { ok: false, detail: err?.message };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const state = allOk ? "HEALTHY" : "DEGRADED"; // §198

  return NextResponse.json({
    state,
    checks,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
}
