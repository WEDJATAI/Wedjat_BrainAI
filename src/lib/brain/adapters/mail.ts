// CIRKLE-MAIL — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "Private email contents must NOT become global Brain knowledge (§5, §48, §75)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #2):
//   - Repo: cirkle-superapp/MAIL — Next.js 16 + Prisma + shadcn/ui + z-ai-web-dev-sdk.
//   - Gmail-like email client w/ Cirkle gold/teal brand, snooze, undo-send (5s),
//     drafts, recipient autocomplete, bulk actions, thread view, full-text search.
//   - Real authorized data the platform would expose (production adapter):
//       • Email threads (subject, sender, recipients, body — scoped to USER only)
//       • Drafts and labels
//       • Commitments extracted from emails (mail.commitment.detect)
//       • Per-thread follow-up suggestions (mail.thread.followup)
//   - Privacy is paramount — email contents MUST stay USER-scoped (§5, §48, §75).

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "mail");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'mail' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the MAIL webhook.
    console.info(
      `[adapter:mail] publishEvents: received ${events.length} events (stub)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call MAIL's authorized read API:
    //   GET /api/mail/threads/search?q=...&userId=...
    //   GET /api/mail/commitments?userId=...
    // and return items like:
    //   { kind: "email.thread", content: "{ threadId, subject, snippet }" }
    //   { kind: "email.commitment", content: "{ threadId, who, what, by }" }
    // §5/§48: results MUST be scoped to the requesting user only — never GLOBAL.
    console.info(
      `[adapter:mail] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would inject the Brain's response into the email
    // thread or as a draft suggestion.
    console.info(
      `[adapter:mail] receiveBrainResponses: requestId=${response.requestId} (stub)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:mail] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:mail] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
