// WEDJAT BRAIN — Platform adapter interface + self-registration barrel (spec §27).
//
// This module:
//   1. Defines the `BrainPlatformAdapter` interface (§27).
//   2. Imports all 14 adapter files at the bottom so they self-register on
//      first import. Callers do `import { getAdapter, listAdapters } from
//      "@/lib/brain/adapters"` and the full registry is ready.
//
// Per spec §27: the Brain owns cognition; the platform remains its own source
// of truth. Per §67: a platform must be REGISTERED/AUTHENTICATED/ACTIVE/
// AUDITED/DEGRADED to publish events. Adapters MUST NOT:
//   - bypass the platform's own governance (e.g. SGTX Governor/OPA/WasmEdge — §11, §45)
//   - fabricate evidence (§8, §165)
//   - autonomously make consequential decisions (§10, §46, §47)
//   - call external URLs in this sandbox — all adapter stubs log only.
//
// NEVER import z-ai-web-dev-sdk here. Adapters are pure integration glue —
// the Brain does the AI calls, adapters only relay authorized data +
// deliver Brain outputs back to the platform.

import type {
  BrainPlatformEvent,
  BrainResponse,
  KnowledgeRecord,
  ModelDescriptor,
} from "@/lib/brain/types";

// ---------------------------------------------------------------
// §27 — the adapter contract
// ---------------------------------------------------------------

/**
 * The contract every platform adapter implements (spec §27). The Brain uses
 * these methods to push approved events to the platform, retrieve authorized
 * data FROM the platform, and deliver Brain outputs (responses, knowledge
 * updates, model capability changes) back to the platform.
 *
 * Stubs in this package LOG and return safe defaults. In production these
 * methods would POST to the platform's webhook or call its authorized API.
 */
export interface BrainPlatformAdapter {
  /** Platform slug (matches PLATFORM_CATALOG[].slug). */
  readonly platformSlug: string;
  /** Human-readable platform name. */
  readonly platformName: string;

  /** The cognitive capabilities this platform exposes to the Brain (§27). */
  getCapabilities(): string[];

  /**
   * Brain → platform. Push approved Brain events to the platform's webhook
   * (or local event queue). Returns counts accepted/rejected by the platform.
   * STUB in this package — logs only, accepts all.
   */
  publishEvents(
    events: BrainPlatformEvent[],
  ): Promise<{ accepted: number; rejected: number }>;

  /**
   * Platform → Brain. Authorized read of platform data scoped to the
   * caller's permissions. STUB in this package — returns [].
   *
   * Production: would call the platform's authorized read API (e.g. CIRKLE's
   * social graph API, MAIL's thread search API, verify's identity-records
   * API — see each adapter file for the specific contract per Phase 0 audit).
   */
  retrieveAuthorizedData(query: {
    text: string;
    scopes: string[];
    tenantId: string;
  }): Promise<{
    items: Array<{ kind: string; content: string; provenance?: string }>;
  }>;

  /**
   * Brain → platform. Deliver a BrainResponse back to the calling application
   * (e.g. into a chat thread, an inbox reply, an audit trail). STUB — logs.
   */
  receiveBrainResponses(response: BrainResponse): Promise<void>;

  /**
   * Brain → platform. Notify the platform that knowledge it depends on has
   * been versioned / superseded / expired (§30, §33). STUB — logs.
   */
  receiveKnowledgeUpdates(knowledge: KnowledgeRecord[]): Promise<void>;

  /**
   * Brain → platform. Notify the platform of model router changes (new model
   * available, fallback chain changed — §45-48). STUB — logs.
   */
  receiveModelCapabilities(models: ModelDescriptor[]): Promise<void>;
}

// Re-export the registry helpers for callers.
export { registerAdapter, getAdapter, listAdapters } from "./registry";

// ---------------------------------------------------------------
// Self-registration: importing this barrel module registers all 14 adapters.
// ---------------------------------------------------------------

import "./cirkle";
import "./mail";
import "./olympex";
import "./mashahd";
import "./verify";
import "./wasl";
import "./aurienta";
import "./sgtx";
import "./mtq";
import "./judge-smart";
import "./egycourt";
import "./sgtx-fable";
import "./ppe";
import "./mtq-sigma";
