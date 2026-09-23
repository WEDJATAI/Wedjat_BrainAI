// WASL — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "Wasl's commitment/authorization semantics remain authoritative in Wasl (§9)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #6):
//   - Repo: cirkle-superapp/wasl — Next.js 16 + Prisma + Socket.io + shadcn/ui +
//     libSQL/Turso (Turso production URL in README).
//   - WhatsApp-like real-time chat: business accounts, AI-verified "commits"
//     (hash + fairness check + two-party signatures + lifecycle pending→active→completed),
//     admin review queue, polls, stories (24h), voice messages, in-chat search.
//   - Real authorized data the platform would expose (production adapter):
//       • Conversations (chat threads, participants, message timeline)
//       • AI-verified "commits" (the wasl.commit.create / wasl.commit.verify surface)
//       • Business accounts (verified, public/private groups)
//       • Polls and stories (24h TTL)
//   - WASL's "commit" lifecycle (pending → active → completed) directly overlaps
//     with Brain's PROPOSED → AUTHORIZED → EXECUTED → VERIFIED action state
//     machine (§52-57). The adapter must NOT override Wasl's commitment state.

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "wasl");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'wasl' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the Wasl webhook OR push over Socket.io
    // (the realtime stack means a pure-REST adapter is insufficient — an
    // event-bridge pattern is required per Phase 0 findings).
    console.info(
      `[adapter:wasl] publishEvents: received ${events.length} events (stub)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call Wasl's authorized read API:
    //   GET /api/wasl/conversations/search?q=...&userId=...
    //   GET /api/wasl/commits?status=pending&userId=...
    //   GET /api/wasl/business/search?query=...
    // and return items like:
    //   { kind: "wasl.message", content: "{ id, threadId, from, body, ts }" }
    //   { kind: "wasl.commit", content: "{ id, hash, parties, status }" }
    //   { kind: "wasl.business", content: "{ id, name, verified }" }
    console.info(
      `[adapter:wasl] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the Wasl
    // chat thread as a bot message OR into the admin review queue.
    console.info(
      `[adapter:wasl] receiveBrainResponses: requestId=${response.requestId} (stub)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:wasl] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:wasl] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
