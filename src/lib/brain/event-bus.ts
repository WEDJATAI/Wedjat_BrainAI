// WEDJAT BRAIN V2 — Cross-platform event bus helpers (spec §20, §68-70).
//
// Shared logic used by /api/brain/events (POST ingest + GET list) and
// /api/brain/events/process (POST pipeline advance). Keeps the route handlers
// thin and the pipeline logic testable in isolation.
//
// §20 — every application may publish approved Brain events.
// §68 — events are versioned (eventVersion).
// §69 — idempotent by eventId (Brain safely ignores duplicates).
// §21 — pipeline: classify → scope → security → provenance → duplicate →
//        novelty → contradiction → quality → promotion decision → index.
// §75 — NO automatic cross-platform memory leakage.
// §97 (Rule 9) — learning candidates are NEVER auto-promoted.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { PLATFORM_CATALOG, getPlatformBySlug, type PlatformCatalogEntry } from "@/lib/brain/platform-registry";
import type { BrainPlatformEvent, PlatformEventPipelineState } from "@/lib/brain/types";

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

/** Platforms whose adapterStatus permits event ingestion (§67, §166). */
const ACTIVE_PLATFORM_STATUSES = new Set([
  "REGISTERED",
  "AUTHENTICATED",
  "ACTIVE",
  "AUDITED",
  "DEGRADED",
]);

/** §24 data-class rank — used to compare an event's classification against a platform's ceiling. */
const CLASSIFICATION_RANK: Record<string, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

/** §56 risk rank — used for tool risk ceiling checks elsewhere; kept here for parity. */
export const NOVELTY_THRESHOLD = 0.3; // events with novelty < this are considered "already known"
export const DUPLICATE_SIMILARITY = 0.95; // cosine ≥ this → duplicate content
export const RECENT_EVENT_WINDOW = 100; // compare novelty against last N events of same type

// ---------------------------------------------------------------
// Pipeline outcome
// ---------------------------------------------------------------

export interface IngestResult {
  ok: boolean;
  eventId: string;
  pipelineState: PlatformEventPipelineState | string;
  duplicate?: boolean; // true if eventId already existed (§69 idempotent skip)
  platformId?: string;
  error?: string;
  status: number;
}

// ---------------------------------------------------------------
// Platform provisioning — auto-seed Platform rows from the catalog so the
// events API works out-of-the-box (the existing seed.ts seeds tenants/apps/
// models/tools but not Platform rows yet).
// ---------------------------------------------------------------

/** Provision a Platform row from the static catalog (§4-18) if it does not yet exist. */
export async function ensurePlatformRow(slug: string): Promise<{ id: string; slug: string; status: string; dataClassCeiling: string } | null> {
  const entry = getPlatformBySlug(slug);
  if (!entry) return null;

  const existing = await db.platform.findUnique({ where: { slug } });
  if (existing) {
    return {
      id: existing.id,
      slug: existing.slug,
      status: existing.status,
      dataClassCeiling: existing.dataClassCeiling,
    };
  }

  // Auto-provision from catalog. Default status = "REGISTERED" (allowed to
  // publish events but not yet fully audited). This matches the schema default.
  const created = await db.platform.create({
    data: {
      slug: entry.slug,
      name: entry.name,
      displayName: entry.displayName,
      domain: entry.domain,
      description: entry.description,
      repoUrl: entry.repoUrl,
      productionUrl: entry.productionUrl,
      adapterStatus: "REGISTERED",
      adapterVersion: null,
      knowledgeScope: entry.knowledgeScope,
      memoryScope: entry.memoryScope,
      toolScope: entry.toolScope,
      dataClassCeiling: entry.dataClassCeiling,
      modelPolicy: entry.modelPolicy,
      allowedBrainScopes: entry.allowedBrainScopes.join(","),
      riskCeiling: entry.riskCeiling,
      capabilities: JSON.stringify(entry.capabilities),
      eventTypes: JSON.stringify(entry.eventTypes),
      domainTools: JSON.stringify(entry.domainTools),
      personality: entry.personality ? JSON.stringify(entry.personality) : null,
      status: "REGISTERED",
    },
  });
  return {
    id: created.id,
    slug: created.slug,
    status: created.status,
    dataClassCeiling: created.dataClassCeiling,
  };
}

/** Resolve a Platform for an incoming event payload. Returns null if not resolvable. */
export async function resolvePlatformForEvent(
  ev: BrainPlatformEvent,
  headerPlatformSlug?: string | null,
): Promise<{ id: string; slug: string; status: string; dataClassCeiling: string } | null> {
  // 1. Explicit platformId
  if (ev.platformId) {
    const p = await db.platform.findUnique({ where: { id: ev.platformId } });
    if (p) {
      return { id: p.id, slug: p.slug, status: p.status, dataClassCeiling: p.dataClassCeiling };
    }
  }

  // 2. platformSlug (payload or header)
  const slug = ev.platformSlug ?? headerPlatformSlug;
  if (slug) {
    const entry = getPlatformBySlug(slug);
    if (entry) {
      return ensurePlatformRow(slug);
    }
    // Slug didn't match the catalog — try the DB directly (custom platform).
    const p = await db.platform.findUnique({ where: { slug } });
    if (p) return { id: p.id, slug: p.slug, status: p.status, dataClassCeiling: p.dataClassCeiling };
  }

  // 3. Resolve via applicationId → PlatformApplication → Platform
  if (ev.applicationId) {
    const link = await db.platformApplication.findFirst({
      where: { applicationId: ev.applicationId },
      include: { platform: true },
    });
    if (link) {
      return {
        id: link.platform.id,
        slug: link.platform.slug,
        status: link.platform.status,
        dataClassCeiling: link.platform.dataClassCeiling,
      };
    }

    // 4. Application exists but no PlatformApplication link yet — infer the
    //    platform from the application slug (e.g. application "mashahd" →
    //    catalog platform "mashahd"). Pragmatic fallback for unlinked apps.
    const app = await db.application.findUnique({ where: { id: ev.applicationId } });
    if (app) {
      const catalogMatch = PLATFORM_CATALOG.find((c) => c.slug === app.slug);
      if (catalogMatch) {
        const row = await ensurePlatformRow(catalogMatch.slug);
        if (row) {
          // Lazily create the PlatformApplication link so future events skip the fallback.
          await db.platformApplication.upsert({
            where: { platformId_applicationId: { platformId: row.id, applicationId: app.id } },
            update: {},
            create: {
              platformId: row.id,
              applicationId: app.id,
              tenantId: app.tenantId,
              status: "ACTIVE",
            },
          }).catch(() => undefined);
          return row;
        }
      }
    }
  }

  return null;
}

/** A platform may publish events only if its adapter is registered/active (§67, §166). */
export function isPlatformAcceptingEvents(status: string): boolean {
  return ACTIVE_PLATFORM_STATUSES.has(status);
}

// ---------------------------------------------------------------
// Identity resolution (default tenant + application for events that
// don't specify one — mirrors the /respond + /retrieve routes).
// ---------------------------------------------------------------

export async function resolveDefaultTenantId(): Promise<string | null> {
  const t = await db.tenant.findUnique({ where: { slug: "acme" } }) ?? (await db.tenant.findFirst());
  return t?.id ?? null;
}

export async function resolveDefaultApplicationId(tenantId: string): Promise<string | null> {
  const a = await db.application.findFirst({ where: { tenantId, slug: "mashahd" } })
    ?? (await db.application.findFirst({ where: { tenantId } }));
  return a?.id ?? null;
}

// ---------------------------------------------------------------
// Validation
// ---------------------------------------------------------------

const REQUIRED_FIELDS = ["eventId", "eventType", "eventVersion", "timestamp", "data"] as const;

/** Validate a BrainPlatformEvent's required fields. Returns an error message or null. */
export function validateEvent(ev: Partial<BrainPlatformEvent>): string | null {
  for (const f of REQUIRED_FIELDS) {
    const v = ev[f];
    if (v === undefined || v === null || v === "") {
      return `missing required field: ${f}`;
    }
  }
  if (typeof ev.eventVersion !== "number" || ev.eventVersion < 1) {
    return "eventVersion must be a positive integer (§68)";
  }
  if (typeof ev.eventType !== "string" || !ev.eventType.includes(".")) {
    return "eventType must be a namespaced string (e.g. 'brain.application.request')";
  }
  if (typeof ev.data !== "object" || Array.isArray(ev.data)) {
    return "data must be an object";
  }
  return null;
}

// ---------------------------------------------------------------
// Content hashing (for §21 duplicate check)
// ---------------------------------------------------------------

/** Deterministic SHA-256 of (eventType + sorted-key data + actorId). */
export function contentHash(ev: BrainPlatformEvent): string {
  const canonical = JSON.stringify({
    eventType: ev.eventType,
    data: ev.data,
    actorId: ev.actor?.id ?? null,
  }, Object.keys({ eventType: ev.eventType, data: ev.data, actorId: ev.actor?.id ?? null }).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

// ---------------------------------------------------------------
// Learning-candidate category mapping (§95)
// ---------------------------------------------------------------

export type LearningCategory =
  | "memory" | "knowledge" | "procedural" | "routing" | "prompt" | "tool" | "evaluation";

/** Map an event type to a learning candidate category (§95). */
export function categoryForEventType(eventType: string): LearningCategory {
  if (eventType.startsWith("brain.knowledge.")) return "knowledge";
  if (eventType.startsWith("brain.tool.") || eventType.startsWith("tool.")) return "tool";
  if (eventType.startsWith("brain.application.")) return "routing";
  if (eventType.startsWith("brain.memory.")) return "memory";
  if (eventType.includes("evaluation_case") || eventType.includes("evaluation.")) return "evaluation";
  if (eventType.includes("correction")) return "procedural";
  // learning.observation, learning.preference, learning.success, learning.failure,
  // brain.user.feedback, default → memory
  return "memory";
}

// ---------------------------------------------------------------
// Classification rank comparison (§24)
// ---------------------------------------------------------------

export function classificationRank(c: string | undefined): number {
  if (!c) return 1; // default INTERNAL
  return CLASSIFICATION_RANK[c] ?? 1;
}

/** Returns true if the event's classification exceeds the platform's ceiling. */
export function exceedsCeiling(
  eventClassification: string | undefined,
  platformCeiling: string,
): boolean {
  return classificationRank(eventClassification) > classificationRank(platformCeiling);
}

// ---------------------------------------------------------------
// Catalog lookup (re-exported for convenience)
// ---------------------------------------------------------------

export function platformCatalogEntry(slug: string): PlatformCatalogEntry | undefined {
  return getPlatformBySlug(slug);
}
