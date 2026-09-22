// POST /api/brain/events/process — advance the cross-platform event pipeline
// for RECEIVED events (spec §21, §94-97). Driven by Inngest or cron.
//
// Per §21 the pipeline is:
//   classify → scope → security check → provenance → duplicate check →
//   novelty → contradiction → quality → promotion decision → index.
//
// Per §75: NO automatic cross-platform memory leakage. Per §97: candidates
// require explicit human/audit review before promotion.
//
// The pipeline logic itself lives in `@/lib/brain/event-pipeline.ts` so it can
// also be invoked by the Inngest background function `brain-event-pipeline`
// (§65) without an HTTP round-trip.

import { NextRequest, NextResponse } from "next/server";
import { processPendingEvents } from "@/lib/brain/event-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);
  const platformId = sp.get("platformId") ?? undefined;

  const results = await processPendingEvents({ limit, platformId });

  return NextResponse.json({
    ok: true,
    processed: results.length,
    promoted_candidates: results.filter((r) => !!r.candidateId).length,
    rejected: results.filter((r) => !!r.rejected).length,
    results,
  });
}
