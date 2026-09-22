// GET /api/brain/platforms/[slug] — single platform detail (spec §160, §161, §165)
// PATCH /api/brain/platforms/[slug] — control plane: enable/disable/configure (§90, §165)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdapter } from "@/lib/brain/adapters/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const platform = await db.platform.findUnique({
    where: { slug },
    include: { adapters: true, platformApps: true },
  });
  if (!platform) return NextResponse.json({ error: "platform not found" }, { status: 404 });
  const adapter = getAdapter(slug);
  const recentEvents = await db.platformEvent.findMany({
    where: { platformId: platform.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const recentHealth = await db.platformHealth.findMany({
    where: { platformId: platform.id },
    orderBy: { capturedAt: "desc" },
    take: 5,
  });
  return NextResponse.json({
    platform: {
      ...platform,
      capabilities: safeJson(platform.capabilities, []),
      eventTypes: safeJson(platform.eventTypes, []),
      domainTools: safeJson(platform.domainTools, []),
      personality: safeJson(platform.personality, null),
      allowedBrainScopes: platform.allowedBrainScopes ? platform.allowedBrainScopes.split(",").filter(Boolean) : [],
      runtimeAdapterLoaded: !!adapter,
      runtimeCapabilities: adapter?.getCapabilities() ?? [],
    },
    recentEvents,
    recentHealth,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json() as { status?: string; adapterStatus?: string; riskCeiling?: string; modelPolicy?: string; reason?: string };
  const platform = await db.platform.findUnique({ where: { slug } });
  if (!platform) return NextResponse.json({ error: "platform not found" }, { status: 404 });
  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.adapterStatus) data.adapterStatus = body.adapterStatus;
  if (body.riskCeiling) data.riskCeiling = body.riskCeiling;
  if (body.modelPolicy) data.modelPolicy = body.modelPolicy;
  const updated = await db.platform.update({ where: { slug }, data });
  // Audit (§129, §165)
  await db.auditEvent.create({
    data: {
      tenantId: (await db.tenant.findFirst())?.id ?? "system",
      actorType: "user",
      actorId: "brain.admin",
      action: "platform.config",
      target: slug,
      reason: body.reason ?? `config update: ${Object.keys(data).join(",")}`,
      severity: "WARN",
      metadata: JSON.stringify(data),
    },
  });
  return NextResponse.json({ platform: updated });
}

function safeJson(s: string | null, fallback: any) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}
