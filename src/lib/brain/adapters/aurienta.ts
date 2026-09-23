// AURIENTA — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "Brain must not make consequential business decisions without application
//    authorization (§10)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #7):
//   - Repo: Aurienta/Aurienta — Next.js + Prisma + shadcn/ui + Tailwind 4 +
//     standalone build + Dockerfile.
//   - "Constitutional launchpad" — noncustodial constitutional infrastructure;
//     transforms capital into real-economy corporate ownership.
//   - **The ONLY audited repo NOT on z-ai-web-dev-sdk** — has 4 parallel AI
//     providers: @google/generative-ai, @huggingface/inference, groq-sdk, openai.
//   - mashahd ↔ Aurienta share identical file sizes for shared top-level files
//     (worklog.md 1.7 MB etc.) — strong fork/template-snapshot evidence.
//   - Real authorized data the platform would expose (production adapter):
//       • Company structures (incorporation docs, ownership stakes)
//       • Partner matching records (aurienta.partner.match surface)
//       • Capital / ownership transfer records (aurienta.capital.deploy surface)
//       • Constitutional charter references (aurienta.charter.verify surface)
//   - §10: Brain may draft / summarize / recommend; consequential business
//     decisions require application authorization. NO autonomous execution.

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "aurienta");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'aurienta' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the Aurienta webhook.
    console.info(
      `[adapter:aurienta] publishEvents: received ${events.length} events (stub)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call Aurienta's authorized read API:
    //   GET /api/companies/{id}?tenantId=...
    //   GET /api/partners/match?query=...
    //   GET /api/capital/records?companyId=...
    // and return items like:
    //   { kind: "company", content: "{ id, name, jurisdiction, ownership }" }
    //   { kind: "partner", content: "{ id, name, matchScore }" }
    //   { kind: "capital.transfer", content: "{ id, from, to, amount }" }
    console.info(
      `[adapter:aurienta] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the Aurienta
    // constitutional launchpad UI.
    console.info(
      `[adapter:aurienta] receiveBrainResponses: requestId=${response.requestId} (stub)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:aurienta] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    // §45-48: Aurienta is the ecosystem outlier (4 parallel AI SDKs). The
    // Brain's model abstraction should treat z-ai-web-dev-sdk as canonical
    // and add a "multi-provider passthrough" adapter for Aurienta's existing
    // SDK fan-out. Do NOT force Aurienta to migrate before integration.
    console.info(
      `[adapter:aurienta] receiveModelCapabilities: ${models.length} models (stub — note: Aurienta uses 4 parallel AI providers per Phase 0 audit)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
