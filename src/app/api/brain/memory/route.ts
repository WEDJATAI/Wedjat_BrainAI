// POST /api/brain/memory — memory management (§167: view, correct, delete, scope).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMemoryCandidate, promoteMemory, supersedeMemory } from "@/lib/brain/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const items = await db.memoryItem.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return NextResponse.json({ memories: items });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action: "create" | "promote" | "supersede" | "delete";
    tenantId: string;
    applicationId: string;
    userId?: string;
    domain?: string;
    type?: string;
    scope?: string;
    content?: string;
    memoryId?: string;
    newContent?: string;
    reason?: string;
  };

  if (body.action === "create") {
    const r = await createMemoryCandidate({
      tenantId: body.tenantId, applicationId: body.applicationId, userId: body.userId,
      domain: (body.domain ?? "SEMANTIC") as any, type: body.type ?? "fact",
      scope: (body.scope ?? "USER") as any, content: body.content ?? "", source: "user", confidence: 0.7,
    });
    return NextResponse.json(r);
  }
  if (body.action === "promote") {
    const r = await promoteMemory(body.memoryId!, body.reason ?? "manual promotion");
    return NextResponse.json({ memory: r });
  }
  if (body.action === "supersede") {
    const r = await supersedeMemory(body.memoryId!, body.newContent!, body.reason ?? "user correction");
    return NextResponse.json({ memory: r });
  }
  if (body.action === "delete") {
    await db.memoryItem.update({ where: { id: body.memoryId! }, data: { status: "DELETED" } });
    await db.auditEvent.create({
      data: {
        tenantId: body.tenantId, actorType: "user", actorId: body.userId ?? "user",
        action: "memory.delete", target: body.memoryId!, reason: body.reason ?? "user deletion", severity: "WARN",
      },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
