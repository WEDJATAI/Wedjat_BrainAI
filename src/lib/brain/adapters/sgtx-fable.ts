// SGTX FABLE — platform adapter stub (spec §27, §67).
// (filename: sgtx-fable.ts, slug: sgtx_fable)
//
// Governance boundary (per PLATFORM_CATALOG):
//   "FABLE data is application-scoped, NOT globally shareable (§15)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #12):
//   - Repo: fortlemem/SGTX_FABLE — TypeScript, 1.8 MB.
//   - README claims Next.js v12 "Sovereign Obsidian & Gold" app with 9 portals
//     (trader, logistics, financier, QC, lab, gov, admin, marketplace, shipping),
//     1.5% FeeLock, USTN shipment identity, GTID tenant identity, Loom audit.
//   - **HOWEVER the actual `package.json` is a 5-dep Hono + Vite stub** —
//     README and code DISAGREE. The v12 Next.js app described in the README
//     is NOT what's in the current `main` branch's package.json.
//   - Real authorized data the platform WOULD expose (per README description —
//     runtime behavior not confirmable until reconciliation):
//       • Per-portal tenant-type-gated data (9 portal types)
//       • Shipment traces (fable.shipment.trace surface)
//       • FeeLock records (1.5%)
//       • Loom audit entries
//   - Phase 0 ranking: P5 (blocked) — adapter work blocked until README ↔
//     package.json reconciliation. The tenant-type gate pattern
//     (`/portal/:id/login` returns 403 for wrong tenant type) is consistent
//     with WEDJAT §62-63 (tenant isolation) — promising IF code matches README.

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "sgtx_fable");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'sgtx_fable' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the SGTX FABLE webhook (per-portal).
    // §15: FABLE data is application-scoped — never global.
    console.info(
      `[adapter:sgtx_fable] publishEvents: received ${events.length} events (stub — Phase 0 P5 blocked: README ↔ package.json inconsistent)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call SGTX FABLE's authorized read API. Per the
    // README (not yet verified against actual code — Phase 0 #12 inconsistency):
    //   GET /portal/{portalId}/api/shipments/{shipmentId}  (tenant-type gated)
    //   GET /portal/{portalId}/api/fees/lock/{id}
    // and return items like:
    //   { kind: "fable.shipment", content: "{ shipmentId, portal, status }", provenance: "fable:portal" }
    //   { kind: "fable.feelock", content: "{ id, rate: 0.015, lockedAt }" }
    //   { kind: "fable.loom.audit", content: "{ id, action, actor, ts }" }
    console.info(
      `[adapter:sgtx_fable] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — Phase 0 P5 blocked, returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the matching
    // SGTX FABLE portal (trader / logistics / financier / QC / lab / gov / admin
    // / marketplace / shipping).
    console.info(
      `[adapter:sgtx_fable] receiveBrainResponses: requestId=${response.requestId} (stub)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:sgtx_fable] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:sgtx_fable] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
