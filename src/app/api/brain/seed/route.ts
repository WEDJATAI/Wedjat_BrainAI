// POST /api/brain/seed — idempotent seed (Phase 0 baseline + golden dataset).
import { NextResponse } from "next/server";
import { seedBrain } from "@/lib/brain/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await seedBrain();
  return NextResponse.json({ ok: true, ...result });
}
