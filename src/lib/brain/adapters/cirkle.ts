// CIRKLE — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "Private user activity must NOT become global Brain knowledge (§4.1)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #1):
//   - Repo: cirkle-superapp/CIRKLE — Next.js 16 + Prisma + shadcn/ui (New York) + libSQL/SQLite.
//   - CIRKLE is the superapp hub for the cirkle-superapp/* family (MAIL, mashahd,
//     verify, wasl all reference the CIRKLE brand).
//   - Heavy docs: MASTER_BLUEPRINT.md, INTEGRATION.md, PHASE0_INSPECTION_REPORT.md.
//   - Real authorized data the platform would expose (production adapter):
//       • User social graph (follows, circles, memberships)
//       • Content catalog (mini-apps, posts, shared items)
//       • Per-user recommendations (the cirkle.feed.recommend tool surface)
//       • Application-scoped identity context (Cirkle user → Brain user mapping)
//   - The Brain MAY NOT republish Cirkle user activity as GLOBAL knowledge (§4.1).

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "cirkle");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'cirkle' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the Cirkle webhook (with HMAC signature).
    // §4.1: events carrying private user activity MUST be scoped to USER or
    // APPLICATION — never GLOBAL.
    console.info(
      `[adapter:cirkle] publishEvents: received ${events.length} events (stub — not delivered to external platform)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call Cirkle's authorized read API:
    //   GET /api/cirkle/social/graph?userId=...&scopes=...
    //   GET /api/cirkle/feed/recommend?userId=...&text=...
    // and return items like:
    //   { kind: "social.graph.user", content: "{ id, name, circle }" }
    //   { kind: "content.miniapp", content: "{ id, title, url }" }
    console.info(
      `[adapter:cirkle] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the BrainResponse back into the Cirkle
    // chat / notification surface where the original request originated.
    console.info(
      `[adapter:cirkle] receiveBrainResponses: requestId=${response.requestId} (stub — not delivered to external platform)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    // STUB — production would notify Cirkle that knowledge it depends on has
    // been versioned / superseded (§30, §33). Useful for Cirkle mini-apps
    // that cache knowledge snapshots.
    console.info(
      `[adapter:cirkle] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    // STUB — production would notify Cirkle of model router changes so its
    // UI can show "powered by GLM-Flash" badges etc.
    console.info(
      `[adapter:cirkle] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
