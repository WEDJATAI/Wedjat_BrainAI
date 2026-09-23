// POST /api/brain/events — cross-platform event ingestion (spec §20, §68-70).
// GET  /api/brain/events?platformId=...&limit=... — list recent events.
//
// §20 — every application may publish approved Brain events.
// §68 — events are versioned (eventVersion).
// §69 — idempotent by eventId (Brain safely ignores duplicates).
// §75 — NO automatic cross-platform memory leakage.
// §21 — pipeline state advances from RECEIVED → ... → INDEXED | REJECTED.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedBrain } from "@/lib/brain/seed";
import {
  resolvePlatformForEvent,
  isPlatformAcceptingEvents,
  resolveDefaultTenantId,
  resolveDefaultApplicationId,
  validateEvent,
  type IngestResult,
} from "@/lib/brain/event-bus";
import type { BrainPlatformEvent } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// POST — accept a single event (object) or a batch (array).
// ---------------------------------------------------------------

export async function POST(req: NextRequest) {
  await ensureSeed();
  const headerPlatformSlug = req.headers.get("x-brain-platform");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const isBatch = Array.isArray(payload);
  const events: BrainPlatformEvent[] = isBatch
    ? (payload as BrainPlatformEvent[])
    : [payload as BrainPlatformEvent];

  if (events.length === 0) {
    return NextResponse.json({ ok: false, error: "no events in payload" }, { status: 400 });
  }

  const results: IngestResult[] = [];
  for (const ev of events) {
    results.push(await ingestOne(ev, headerPlatformSlug));
  }

  if (!isBatch) {
    const r = results[0]!;
    return NextResponse.json({ ok: r.ok, eventId: r.eventId, pipelineState: r.pipelineState, duplicate: r.duplicate, platformId: r.platformId, error: r.error }, { status: r.status });
  }
  return NextResponse.json({
    ok: results.every((r) => r.ok),
    count: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results: results.map((r) => ({
      ok: r.ok,
      eventId: r.eventId,
      pipelineState: r.pipelineState,
      duplicate: r.duplicate,
      platformId: r.platformId,
      error: r.error,
    })),
  }, { status: 200 });
}

/** Ingest a single event: validate → resolve platform → idempotency → persist. */
async function ingestOne(ev: Partial<BrainPlatformEvent>, headerPlatformSlug: string | null): Promise<IngestResult> {
  // 1. Validate required fields (§20).
  const validationError = validateEvent(ev);
  if (validationError) {
    return { ok: false, eventId: ev.eventId ?? "", pipelineState: "REJECTED", error: validationError, status: 400 };
  }

  // 2. Resolve the platform (slug, id, or via applicationId). If unresolvable
  //    or not active → reject 403 (§67 — adapter must be registered/active).
  const platform = await resolvePlatformForEvent(ev as BrainPlatformEvent, headerPlatformSlug);
  if (!platform) {
    return {
      ok: false,
      eventId: ev.eventId!,
      pipelineState: "REJECTED",
      error: "platform not registered — cannot publish events (§67). Provide platformSlug or link applicationId to a platform.",
      status: 403,
    };
  }
  if (!isPlatformAcceptingEvents(platform.status)) {
    return {
      ok: false,
      eventId: ev.eventId!,
      pipelineState: "REJECTED",
      error: `platform ${platform.slug} is ${platform.status} — not accepting events (§67, §166)`,
      status: 403,
    };
  }

  // 3. Resolve tenantId + applicationId (defaults if not provided — §16, §62).
  let tenantId = ev.tenantId ?? null;
  if (!tenantId) tenantId = await resolveDefaultTenantId();
  if (!tenantId) {
    return { ok: false, eventId: ev.eventId!, pipelineState: "REJECTED", error: "tenantId not provided and no default tenant exists", status: 400 };
  }

  let applicationId = ev.applicationId ?? null;
  if (!applicationId) {
    // Try PlatformApplication link first (preferred), else default app.
    const link = await db.platformApplication.findFirst({ where: { platformId: platform.id, tenantId } });
    applicationId = link?.applicationId ?? (await resolveDefaultApplicationId(tenantId));
  }
  if (!applicationId) {
    return { ok: false, eventId: ev.eventId!, pipelineState: "REJECTED", error: "applicationId not provided and no default application exists", status: 400 };
  }

  // 4. Idempotency: if eventId already exists (§69), return the existing record
  //    WITHOUT reprocessing. Brain safely ignores duplicates.
  const existing = await db.platformEvent.findUnique({ where: { eventId: ev.eventId! } });
  if (existing) {
    return {
      ok: true,
      eventId: existing.eventId,
      pipelineState: existing.pipelineState,
      duplicate: true,
      platformId: existing.platformId,
      status: 200,
    };
  }

  // 5. Determine classification + scope (default to platform ceiling / APPLICATION scope).
  const classification = ev.classification ?? "INTERNAL";
  const scope = ev.scope ?? "APPLICATION";

  // 6. Persist PlatformEvent (pipelineState = RECEIVED).
  const created = await db.platformEvent.create({
    data: {
      eventId: ev.eventId!,
      eventType: ev.eventType!,
      eventVersion: ev.eventVersion!,
      platformId: platform.id,
      tenantId,
      applicationId,
      userId: ev.userId ?? null,
      requestId: ev.requestId ?? null,
      actorType: ev.actor?.type ?? null,
      actorId: ev.actor?.id ?? null,
      data: JSON.stringify(ev.data ?? {}),
      provenance: ev.provenance ? JSON.stringify(ev.provenance) : null,
      classification,
      scope,
      pipelineState: "RECEIVED",
    },
  });

  // 7. Also create a BrainEvent row (the existing observability table, §113-114)
  //    for unified trace + audit visibility.
  try {
    await db.brainEvent.create({
      data: {
        eventId: `${ev.eventId}#platform`,
        eventType: `platform.${ev.eventType}`,
        eventVersion: ev.eventVersion!,
        tenantId,
        applicationId,
        runId: ev.requestId ?? null, // approximate run linkage
        actorType: ev.actor?.type ?? "system",
        actorId: ev.actor?.id ?? platform.slug,
        data: JSON.stringify({
          platformEventId: created.id,
          platformSlug: platform.slug,
          platformEvent: ev,
        }),
      },
    });
  } catch {
    // Non-fatal — the PlatformEvent row is the source of truth for the bus.
    // BrainEvent may collide on eventId if the same payload is republished; ignore.
  }

  return {
    ok: true,
    eventId: created.eventId,
    pipelineState: created.pipelineState,
    duplicate: false,
    platformId: platform.id,
    status: 201,
  };
}

// ---------------------------------------------------------------
// GET — list recent events with their pipeline state.
// ---------------------------------------------------------------

export async function GET(req: NextRequest) {
  await ensureSeed();
  const sp = req.nextUrl.searchParams;
  const platformId = sp.get("platformId") ?? undefined;
  const platformSlug = sp.get("platformSlug") ?? undefined;
  const eventType = sp.get("eventType") ?? undefined;
  const tenantId = sp.get("tenantId") ?? undefined;
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);

  // If only slug given, resolve to platformId.
  let resolvedPlatformId = platformId;
  if (!resolvedPlatformId && platformSlug) {
    const p = await db.platform.findUnique({ where: { slug: platformSlug } });
    resolvedPlatformId = p?.id;
    if (!resolvedPlatformId) {
      return NextResponse.json({ ok: false, error: `platform slug '${platformSlug}' not found` }, { status: 404 });
    }
  }

  const where: Record<string, unknown> = {};
  if (resolvedPlatformId) where.platformId = resolvedPlatformId;
  if (eventType) where.eventType = eventType;
  if (tenantId) where.tenantId = tenantId;

  const events = await db.platformEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { platform: { select: { slug: true, displayName: true, domain: true } } },
  });

  return NextResponse.json({
    ok: true,
    count: events.length,
    events: events.map((e) => ({
      id: e.id,
      eventId: e.eventId,
      eventType: e.eventType,
      eventVersion: e.eventVersion,
      platformId: e.platformId,
      platformSlug: e.platform.slug,
      platformName: e.platform.displayName,
      platformDomain: e.platform.domain,
      tenantId: e.tenantId,
      applicationId: e.applicationId,
      userId: e.userId,
      requestId: e.requestId,
      actorType: e.actorType,
      actorId: e.actorId,
      data: safeJson(e.data),
      provenance: safeJson(e.provenance),
      classification: e.classification,
      scope: e.scope,
      pipelineState: e.pipelineState,
      pipelineError: e.pipelineError,
      processedAt: e.processedAt,
      createdAt: e.createdAt,
    })),
  });
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function safeJson(s: string | null): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

async function ensureSeed() {
  const tenantCount = await db.tenant.count();
  if (tenantCount === 0) await seedBrain();
}
