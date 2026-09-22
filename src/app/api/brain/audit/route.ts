// GET /api/brain/audit — audit log (§129, §130).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const events = await db.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
  return NextResponse.json({ events });
}
