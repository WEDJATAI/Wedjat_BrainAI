// MTQ / MITHQAL — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "analysis ≠ authorization; recommendation ≠ transaction execution (§12, §47)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #9):
//   - Repo: MITHQALMTQ/MTQ — **STUB repo (5 KB, only LICENSE + 183-byte README)**.
//   - README content (in full): "MITHQAL adds a neutral settlement capability
//     next to existing banking infrastructure. The integration principle is
//     translation, not transformation. Your bank remains your bank."
//   - No runtime to integrate with — concept lives in prose only.
//   - Per §186: this platform CANNOT be claimed as integrated until MTQ has
//     actual code. The operational MITHQAL presence is MITHQALMTQ/MTQ_SIGMA
//     (platform #14, separate adapter at src/lib/brain/adapters/mtq-sigma.ts).
//   - Real authorized data the platform WOULD expose (hypothetical — not
//     implementable until runtime exists):
//       • Market intelligence data (mtq.market.lookup surface)
//       • Risk signals (mtq.risk.signal surface)
//       • Asset classifications (mtq.asset.classify surface)

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "mtq");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'mtq' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — MTQ's runtime does not exist publicly (Phase 0 #9 — stub repo).
    // Production adapter blocked until MTQ exposes a runtime API.
    console.info(
      `[adapter:mtq] publishEvents: received ${events.length} events (stub — MTQ runtime not yet public per Phase 0 §186)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call MTQ's authorized read API (HYPOTHETICAL —
    // MTQ's runtime does not exist publicly yet per Phase 0):
    //   GET /api/market/lookup?symbol=...
    //   GET /api/risk/signals?assetClass=...
    // and return items like:
    //   { kind: "market.quote", content: "{ symbol, price, ts }" }
    //   { kind: "risk.signal", content: "{ assetClass, level, factors }" }
    console.info(
      `[adapter:mtq] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — MTQ runtime not yet public per Phase 0 §186, returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the MTQ
    // operator UI. Per §47: any transaction execution requires external
    // application authorization — the Brain NEVER executes transactions.
    console.info(
      `[adapter:mtq] receiveBrainResponses: requestId=${response.requestId} (stub — analysis ≠ authorization per §12 §47)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:mtq] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:mtq] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
