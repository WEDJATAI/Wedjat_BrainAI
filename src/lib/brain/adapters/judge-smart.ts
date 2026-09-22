// JUDGE-SMART — platform adapter stub (spec §27, §67).
// (filename: judge-smart.ts, slug: judge_smart)
//
// Governance boundary (per PLATFORM_CATALOG):
//   "Brain must NOT autonomously make final legal judgments (§13, §46).
//    AI assistance + evidence + human/legal authority required."
//
// Phase 0 audit (docs/phase0-audit.md, platform #10):
//   - Repo: fortlemem/judge_synapse — Next.js + Prisma + shadcn/ui + libSQL/Turso
//     + next-auth + next-intl. Arabic-first UI ("المنصة القضائية الذكية V2.1").
//   - 5-tab case workspace (Overview / Facts&Evidence / Law / Analysis / Decision).
//   - **14 Egyptian government portals indexed** (Constitution, Official Gazette,
//     Cassation, State Council, Supreme Constitutional).
//   - **39 authenticated legal texts** with full provenance; signed corpus
//     snapshot `EJB-CORPUS-2026.08-R1`.
//   - Hybrid search (exact + lexical + temporal). Strict judge/system separation:
//     `system_proposal` (non-binding) vs. `judge_decision` (binding) vs.
//     `adversary_transfer` (adversarial review).
//   - Second most Brain-aligned repo (Phase 0 ranking P1).
//   - Real authorized data the platform would expose (production adapter):
//       • Cases (5-tab workspace contents)
//       • Legal corpus (39 texts + signed snapshot reference)
//       • Precedent search results (hybrid search)
//       • Evidence organization records (judge.evidence.organize surface)
//   - §46 / §165: Brain proposals MUST be labelled non-binding. The adapter
//     MUST preserve judge_synapse's system_proposal vs. judge_decision split.

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "judge_smart");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'judge_smart' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the judge_synapse webhook.
    // §46 / §165: every event carrying a system_proposal MUST be labelled
    // non-binding — never promote to judge_decision without explicit judge
    // action inside judge_synapse.
    console.info(
      `[adapter:judge_smart] publishEvents: received ${events.length} events (stub — system_proposal stays non-binding, §46 §165)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call judge_synapse's authorized read API:
    //   GET /api/cases/{caseId}?tenantId=...
    //   GET /api/corpus/search?q=...&mode=hybrid
    //   GET /api/precedents?text=...
    // and return items like:
    //   { kind: "case", content: "{ caseId, parties, court, status }", provenance: "judge_synapse:case" }
    //   { kind: "corpus.text", content: "{ id, title, citation, text }", provenance: "EJB-CORPUS-2026.08-R1" }
    //   { kind: "precedent", content: "{ id, ruling, year, relevance }", provenance: "judge_synapse:hybrid-search" }
    console.info(
      `[adapter:judge_smart] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the judge's
    // case workspace Analysis tab as a NON-BINDING system_proposal (§46).
    // The judge retains full authority to accept, modify, or reject.
    console.info(
      `[adapter:judge_smart] receiveBrainResponses: requestId=${response.requestId} (stub — delivered as system_proposal, NOT judge_decision per §46 §165)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:judge_smart] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:judge_smart] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
