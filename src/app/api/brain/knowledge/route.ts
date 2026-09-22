// POST /api/brain/knowledge — knowledge management (§168, §105).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createKnowledgeCandidate, promoteKnowledge } from "@/lib/brain/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const items = await db.knowledgeItem.findMany({
    where: tenantId ? { tenantId } : undefined,
    include: { source: true, evidence: true },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action: "create" | "promote";
    tenantId: string;
    applicationId: string;
    type?: string;
    claim?: string;
    content?: string;
    scope?: string;
    itemId?: string;
    reason?: string;
  };

  if (body.action === "create") {
    const r = await createKnowledgeCandidate({
      tenantId: body.tenantId, applicationId: body.applicationId,
      type: (body.type ?? "FACT") as any, claim: body.claim ?? "", content: body.content ?? "",
      scope: (body.scope ?? "APPLICATION") as any, confidence: 0.4,
    });
    return NextResponse.json({ item: r });
  }
  if (body.action === "promote") {
    const r = await promoteKnowledge(body.itemId!, body.reason ?? "manual validation");
    return NextResponse.json({ item: r });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
