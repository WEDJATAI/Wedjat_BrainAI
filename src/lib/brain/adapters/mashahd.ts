// MASHAHD — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "User engagement signals must NOT auto-become global knowledge (§7)."
//
// Phase 0 audit (docs/phase0-audit.md, platform #4):
//   - Repo: cirkle-superapp/mashahd — Next.js 16 + Prisma + shadcn/ui +
//     @aws-sdk/client-s3 + libSQL/SQLite. Multi-service runtime: dev:app,
//     dev:tracker, dev:party.
//   - Video streaming app with P2P/networking architecture (heavy docs:
//     MEDIA_FABRIC_CHECKLIST, P2P_NETWORKING, VIDEO_STREAMING_ARCHITECTURE).
//   - mashahd ↔ Aurienta share identical file sizes for shared top-level files
//     (worklog.md 1.7 MB etc.) — strong fork/template-snapshot evidence.
//   - Real authorized data the platform would expose (production adapter):
//       • Video catalog (titles, creators, durations, thumbnails)
//       • Per-user watch history + playback state
//       • Video transcripts (the mashahd.transcript.search tool surface)
//       • Engagement signals (likes, completions — must NOT auto-become global, §7)
//   - Defer until mashahd exposes a README (Phase 0 ranking P4).

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "mashahd");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'mashahd' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the Mashahd webhook.
    console.info(
      `[adapter:mashahd] publishEvents: received ${events.length} events (stub)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call Mashahd's authorized read API:
    //   GET /api/videos/search?q=...&userId=...
    //   GET /api/transcripts/{videoId}?userId=...
    //   GET /api/history?userId=...
    // and return items like:
    //   { kind: "video", content: "{ id, title, duration, creator }" }
    //   { kind: "transcript", content: "{ videoId, segments: [...] }" }
    //   { kind: "watch.history", content: "{ videoId, progressPct }" }
    console.info(
      `[adapter:mashahd] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would inject the Brain's response into the Mashahd
    // in-app chat / discovery surface.
    console.info(
      `[adapter:mashahd] receiveBrainResponses: requestId=${response.requestId} (stub)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:mashahd] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:mashahd] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
