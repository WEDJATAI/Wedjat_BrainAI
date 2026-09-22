// GET /api/brain/platforms — list all registered platforms (spec §30, §89, §160)
// POST /api/brain/platforms — publish a cross-platform event (alias /events)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import "@/lib/brain/adapters"; // side-effect: registers all 14 platform adapters
import { listAdapters } from "@/lib/brain/adapters/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const withHealth = req.nextUrl.searchParams.get("health") !== "false";
  const platforms = await db.platform.findMany({
    orderBy: { domain: "asc" },
    include: { adapters: true, platformApps: true },
  });
  const adapters = listAdapters();
  const adapterBySlug = new Map(adapters.map((a) => [a.platformSlug, a]));
  // Attach runtime adapter availability + rollup counts
  const enriched = platforms.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    displayName: p.displayName,
    domain: p.domain,
    description: p.description,
    repoUrl: p.repoUrl,
    productionUrl: p.productionUrl,
    adapterStatus: p.adapterStatus,
    adapterVersion: p.adapterVersion,
    sdkVersion: p.adapters[0]?.sdkVersion ?? null,
    knowledgeScope: p.knowledgeScope,
    memoryScope: p.memoryScope,
    toolScope: p.toolScope,
    dataClassCeiling: p.dataClassCeiling,
    modelPolicy: p.modelPolicy,
    riskCeiling: p.riskCeiling,
    allowedBrainScopes: p.allowedBrainScopes ? p.allowedBrainScopes.split(",").filter(Boolean) : [],
    capabilities: safeJson(p.capabilities, []),
    eventTypes: safeJson(p.eventTypes, []),
    domainTools: safeJson(p.domainTools, []),
    personality: safeJson(p.personality, null),
    status: p.status,
    runtimeAdapterLoaded: adapterBySlug.has(p.slug),
    linkedApplicationIds: p.platformApps.map((pa) => pa.applicationId),
    lastHeartbeatAt: p.lastHeartbeatAt,
    lastEventAt: p.lastEventAt,
    requestCount: p.requestCount,
    errorCount: p.errorCount,
    costUsdTotal: p.costUsdTotal,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
  const summary = {
    total: platforms.length,
    active: platforms.filter((p) => p.status === "ACTIVE").length,
    audited: platforms.filter((p) => p.adapterStatus === "AUDITED").length,
    degraded: platforms.filter((p) => p.status === "DEGRADED").length,
    disabled: platforms.filter((p) => p.status === "DISABLED").length,
    adaptersLoaded: adapters.length,
    byDomain: groupBy(platforms, (p) => p.domain),
  };
  return NextResponse.json({ platforms: enriched, summary, withHealth });
}

function safeJson(s: string | null, fallback: any) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}
function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of arr) { const k = key(t); out[k] = (out[k] ?? 0) + 1; }
  return out;
}
