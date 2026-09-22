// OLYMPEX — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "Export/RFQ data is application-scoped (§6)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #3):
//   - Repo: fortleem/olympex_export — Next.js 16 (App Router, Turbopack) +
//     Prisma + SQLite + shadcn/ui + react-hook-form/zod.
//   - Egyptian fresh/frozen produce exporter corporate site + RFQ pipeline +
//     hardened public API (rate-limited).
//   - Real authorized data the platform would expose (production adapter):
//       • Product catalog (produce SKUs, availability, pricing tiers)
//       • RFQ submissions and quote status (olympex.rfq.lookup tool)
//       • Logistics status for active shipments
//   - Lowest-complexity integration target of the fortleem family (Phase 0 ranking P3).

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "olympex");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'olympex' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the OlympEx webhook.
    console.info(
      `[adapter:olympex] publishEvents: received ${events.length} events (stub)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call OlympEx's authorized read API:
    //   GET /api/products?search=...&tenantId=...
    //   GET /api/rfq/{id}/status
    // and return items like:
    //   { kind: "product", content: "{ sku, name, priceUsd, availableKg }" }
    //   { kind: "rfq.status", content: "{ rfqId, status, eta }" }
    console.info(
      `[adapter:olympex] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the OlympEx
    // admin console or RFQ pipeline UI.
    console.info(
      `[adapter:olympex] receiveBrainResponses: requestId=${response.requestId} (stub)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:olympex] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:olympex] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
