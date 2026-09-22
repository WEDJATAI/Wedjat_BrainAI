// GET /api/brain/metrics — observability dashboard data (§127).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [runs, modelUsage, toolExecutions, auditEvents, candidates] = await Promise.all([
    db.brainRun.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.modelUsage.findMany({ where: { createdAt: { gte: since } } }),
    db.toolExecution.findMany({ where: { createdAt: { gte: since } } }),
    db.auditEvent.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.learningCandidate.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const totalCost = modelUsage.reduce((s, u) => s + u.costUsd, 0);
  const totalTokensIn = modelUsage.reduce((s, u) => s + u.tokensIn, 0);
  const totalTokensOut = modelUsage.reduce((s, u) => s + u.tokensOut, 0);
  const fallbackRate = modelUsage.length ? modelUsage.filter((u) => u.fallbackUsed).length / modelUsage.length : 0;
  const failureRate = modelUsage.length ? modelUsage.filter((u) => !u.success).length / modelUsage.length : 0;

  // Latency distribution
  const latencies = runs.map((r) => r.latencyMs).filter((l) => l > 0).sort((a, b) => a - b);
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;

  // By model
  const byModel: Record<string, { calls: number; cost: number; tokensOut: number; fallbacks: number }> = {};
  for (const u of modelUsage) {
    const k = u.modelId;
    byModel[k] = byModel[k] ?? { calls: 0, cost: 0, tokensOut: 0, fallbacks: 0 };
    byModel[k].calls++;
    byModel[k].cost += u.costUsd;
    byModel[k].tokensOut += u.tokensOut;
    if (u.fallbackUsed) byModel[k].fallbacks++;
  }

  // By tool
  const byTool: Record<string, { total: number; verified: number; failed: number }> = {};
  for (const t of toolExecutions) {
    byTool[t.toolId] = byTool[t.toolId] ?? { total: 0, verified: 0, failed: 0 };
    byTool[t.toolId].total++;
    if (t.state === "VERIFIED") byTool[t.toolId].verified++;
    if (t.state === "FAILED" || t.state === "TIMED_OUT") byTool[t.toolId].failed++;
  }

  return NextResponse.json({
    window: "24h",
    totals: {
      runs: runs.length,
      modelCalls: modelUsage.length,
      toolExecutions: toolExecutions.length,
      auditEvents: auditEvents.length,
      candidates: candidates.length,
      totalCostUsd: totalCost,
      totalTokensIn,
      totalTokensOut,
      fallbackRate,
      failureRate,
    },
    latency: { p50, p95, p99 },
    byModel,
    byTool,
    recentRuns: runs.slice(0, 20).map((r) => ({
      requestId: r.requestId,
      status: r.status,
      modelUsed: r.modelUsed,
      fallbackUsed: r.fallbackUsed,
      retrievalUsed: r.retrievalUsed,
      verificationUsed: r.verificationUsed,
      toolsUsed: r.toolsUsed ? JSON.parse(r.toolsUsed) : [],
      evidenceCount: r.evidenceCount,
      memoryCount: r.memoryCount,
      costUsd: r.costUsd,
      latencyMs: r.latencyMs,
      createdAt: r.createdAt,
    })),
  });
}
