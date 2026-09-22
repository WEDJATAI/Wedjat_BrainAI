// POST /api/brain/tools/approve — approve a paused tool execution (§56, §57).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approveToolExecution } from "@/lib/brain/tools";
import { resolveIdentity } from "@/lib/brain/identity";
import type { BrainRequest } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { executionId: string; approver: string; tenantId?: string; applicationId?: string; userId?: string };

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
    requestId: "approve-" + crypto.randomUUID(),
    tenantId, applicationId, userId,
    input: { text: "" }, permissions: { scopes: ["brain:admin"] },
  } as BrainRequest);

  const result = await approveToolExecution(body.executionId, body.approver, identity);
  return NextResponse.json({ result });
}
