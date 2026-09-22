// GET /api/brain/trace?requestId=... — request trace view (§73, §128).
// Returns BrainRun + steps + events + tool executions + audit.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });

  const run = await db.brainRun.findUnique({
    where: { requestId },
    include: {
      steps: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      toolExecutions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ run });
}
