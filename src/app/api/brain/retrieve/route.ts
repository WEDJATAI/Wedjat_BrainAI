// POST /api/brain/retrieve — explicit hybrid retrieval (§34).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hybridRetrieve } from "@/lib/brain/retrieval";
import { resolveIdentity } from "@/lib/brain/identity";
import type { BrainRequest } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { text: string; tenantId?: string; applicationId?: string; userId?: string; topK?: number };

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

  const identity = await resolveIdentity({
    requestId: "retrieve-" + crypto.randomUUID(),
    tenantId, applicationId, userId,
    input: { text: body.text }, permissions: { scopes: ["brain:read"] },
  } as BrainRequest);

  const result = await hybridRetrieve({ identity, text: body.text, topK: body.topK ?? 10 });
  return NextResponse.json(result);
}
