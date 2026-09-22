// EGYCOURT — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "High-sensitivity court data — no unrestricted global Brain access (§14, §94)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #11):
//   - Repo: egycourt/egycourt — **HTTP 404 Not Found**. The org `egycourt`
//     exists on GitHub but has `public_repos: 0`.
//   - Per spec §186: "Never claim a platform is integrated when only its
//     repository has been inspected." — and here we couldn't even inspect.
//     EGYCOURT CANNOT be claimed as integrated until a public repo appears
//     or the owner grants access.
//   - Real authorized data the platform WOULD expose (hypothetical — based
//     on spec §14 only, since no code is available for inspection):
//       • Court case models (egycourt.case.lookup surface)
//       • Court documents (egycourt.document.search surface)
//       • Court roles and permissions

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "egycourt");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'egycourt' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — EGYCOURT's repo is 404 / not inspectable (Phase 0 §186).
    // Production adapter blocked until the platform exposes a runtime API.
    console.info(
      `[adapter:egycourt] publishEvents: received ${events.length} events (stub — repo 404 per Phase 0 §186, no runtime to deliver to)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call EgyCourt's authorized read API (HYPOTHETICAL
    // — repo is 404, no runtime to inspect per Phase 0 §186):
    //   GET /api/cases/{caseId}?tenantId=...
    //   GET /api/documents/search?q=...
    // and return items like:
    //   { kind: "court.case", content: "{ caseId, parties, court, status }" }
    //   { kind: "court.document", content: "{ docId, type, parties, filedAt }" }
    console.info(
      `[adapter:egycourt] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — repo 404 per Phase 0 §186, returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the EgyCourt
    // operator UI. §14 / §94: high-sensitivity court data — never global access.
    console.info(
      `[adapter:egycourt] receiveBrainResponses: requestId=${response.requestId} (stub — high-sensitivity per §14 §94)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:egycourt] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:egycourt] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
