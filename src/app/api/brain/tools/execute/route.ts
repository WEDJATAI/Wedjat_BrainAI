// POST /api/brain/tools/execute — explicit tool execution (§13, §52).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeTool, toDescriptor } from "@/lib/brain/tools";
import { resolveIdentity } from "@/lib/brain/identity";
import { resolvePolicy } from "@/lib/brain/policy";
import type { BrainRequest, ToolCall } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { toolId: string; input: Record<string, unknown>; tenantId?: string; applicationId?: string; userId?: string; runId?: string };

  // Resolve a default identity if not provided (demo convenience).
  let tenantId = body.tenantId;
  let applicationId = body.applicationId;
  let userId = body.userId;
  if (!tenantId) {
    let t = await db.tenant.findUnique({ where: { slug: "acme" } });
    if (!t) t = (await db.tenant.findFirst())!;
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

  const identityReq: BrainRequest = {
    requestId: "tool-" + crypto.randomUUID(),
    tenantId, applicationId, userId,
    input: { text: "" },
    permissions: { scopes: ["brain:tools.execute"] },
  };
  const identity = await resolveIdentity(identityReq);
  const policy = await resolvePolicy(identity);

  const toolRow = await db.tool.findUnique({ where: { toolId: body.toolId } });
  if (!toolRow) return NextResponse.json({ error: "tool not found" }, { status: 404 });
  const tool = toDescriptor(toolRow);

  const call: ToolCall = { toolId: body.toolId, input: body.input, tenantId, runId: body.runId };
  const result = await executeTool({ call, tool, identity, policy, runId: body.runId });
  return NextResponse.json({ result });
}
