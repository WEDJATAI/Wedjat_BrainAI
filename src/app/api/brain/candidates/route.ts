// GET  /api/brain/candidates — list learning candidates (§94).
// POST /api/brain/candidates — decide (PROMOTE | REJECT) on a candidate.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listCandidates, decideCandidate } from "@/lib/brain/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (tenantId) {
    const list = await listCandidates(tenantId, 50);
    return NextResponse.json({ candidates: list });
  }
  const all = await db.learningCandidate.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ candidates: all });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { id: string; decision: "PROMOTED" | "REJECTED" | "DEFERRED"; reason?: string };
  if (!body.id || !body.decision) {
    return NextResponse.json({ error: "id and decision required" }, { status: 400 });
  }
  await decideCandidate(body.id, body.decision, body.reason ?? `manual ${body.decision.toLowerCase()}`);
  return NextResponse.json({ ok: true });
}
