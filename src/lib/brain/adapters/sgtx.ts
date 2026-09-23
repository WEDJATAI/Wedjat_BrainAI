// SGTX — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "DO NOT bypass SGTX Governor / OPA / WasmEdge / Human Authorization /
//    Crypto Signature / Loom / NATS (§11, §45). AI advice ≠ authorization;
//    AI recommendation ≠ execution."
//
// Phase 0 audit (docs/phase0-audit.md, platform #8):
//   - Repo: SGTX-PILOT/SGTX — Next.js + Prisma + shadcn/ui + @noble/ed25519 +
//     libSQL + Postgres scripts (dual DB).
//   - Sovereign Governed Trade Execution — non-custodial, AI-governed trade
//     execution engine; Ed25519 signatures for cryptographic cross-border trade.
//   - Test suite is the most complete in the audit (Playwright e2e).
//   - Real authorized data the platform would expose (production adapter):
//       • Trade execution records (signed intents, Ed25519 signatures)
//       • Compliance checks (sgtx.compliance.check surface)
//       • Risk signals (sgtx.risk.signal surface)
//       • Document classifications (sgtx.document.classify surface)
//   - **Critical**: the Brain must NEVER hold SGTX private keys (§62 identity
//     isolation). All signing happens inside SGTX's own Governor pipeline.

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "sgtx");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'sgtx' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the SGTX webhook. SGTX would re-validate
    // every event through its Governor / OPA policy / WasmEdge sandbox before
    // it reaches the trade execution layer. The Brain NEVER bypasses this.
    console.info(
      `[adapter:sgtx] publishEvents: received ${events.length} events (stub — Governor/OPA/WasmEdge pipeline NOT bypassed, §11 §45)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call SGTX's authorized read API:
    //   GET /api/trades/{id}?tenantId=...  (signed trade intents)
    //   GET /api/compliance/check?tradeId=...
    //   GET /api/risk/signals?tenantId=...
    // and return items like:
    //   { kind: "trade", content: "{ tradeId, parties, jurisdiction, signedAt }", provenance: "sgtx:ed25519" }
    //   { kind: "compliance", content: "{ tradeId, checks: [...] }", provenance: "sgtx:opa" }
    //   { kind: "risk.signal", content: "{ tradeId, level, factors }" }
    // §62: Brain MUST NOT request or hold SGTX private keys.
    console.info(
      `[adapter:sgtx] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the SGTX
    // operator UI as a NON-BINDING recommendation (§165). Human authorization
    // is always required before any trade execution.
    console.info(
      `[adapter:sgtx] receiveBrainResponses: requestId=${response.requestId} (stub — NON-BINDING, §11 §45)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:sgtx] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:sgtx] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
