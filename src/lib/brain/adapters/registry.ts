// WEDJAT BRAIN — Platform adapter registry (spec §27, §67).
//
// Adapters are the contract surface between the Brain and each external
// platform (cirkle, mail, olympex, mashahd, verify, wasl, aurienta, sgtx,
// mtq, judge_smart, egycourt, sgtx_fable, ppe, mtq_sigma — 14 platforms
// per spec §4-18, see PLATFORM_CATALOG).
//
// Each adapter implements `BrainPlatformAdapter`. Adapters self-register at
// module load via `registerAdapter(adapter)` (see bottom of each adapter
// file). The registry guards against double-registration so importing an
// adapter module twice is safe.
//
// Per §27: the Brain owns cognition; the platform remains its own source
// of truth. Per §67: a platform must be REGISTERED/AUTHENTICATED/ACTIVE/
// AUDITED/DEGRADED to publish events. Adapters MUST NOT:
//   - bypass the platform's own governance (e.g. SGTX Governor/OPA/WasmEdge — §11, §45)
//   - fabricate evidence (§8, §165)
//   - autonomously make consequential decisions (§10, §46, §47)
//   - call external URLs in this sandbox — all adapter stubs log only.
//
// Per spec §27 the adapter interface:
//   - getCapabilities() — platform's cognitive capabilities
//   - publishEvents() — Brain → platform (push approved events to platform webhooks)
//   - retrieveAuthorizedData() — platform → Brain (authorized read of platform data)
//   - receiveBrainResponses() — Brain → platform (deliver BrainResponse back to the app)
//   - receiveKnowledgeUpdates() — Brain → platform (knowledge version bumps / supersessions)
//   - receiveModelCapabilities() — Brain → platform (model router changes)

import type { BrainPlatformAdapter } from "./index";

// ---------------------------------------------------------------
// Registry
// ---------------------------------------------------------------

const adapterRegistry = new Map<string, BrainPlatformAdapter>();

/**
 * Register an adapter. Idempotent — if an adapter with the same platformSlug
 * is already registered, this is a no-op (so importing the same adapter
 * module twice in different routes does not throw or duplicate).
 */
export function registerAdapter(adapter: BrainPlatformAdapter): void {
  if (adapterRegistry.has(adapter.platformSlug)) {
    return;
  }
  adapterRegistry.set(adapter.platformSlug, adapter);
}

/** Get the registered adapter for a platform slug. */
export function getAdapter(slug: string): BrainPlatformAdapter | undefined {
  return adapterRegistry.get(slug);
}

/** List all registered adapters (insertion order). */
export function listAdapters(): BrainPlatformAdapter[] {
  return Array.from(adapterRegistry.values());
}

/** Clear the registry (test-only). Not used in production code paths. */
export function _clearAdaptersForTest(): void {
  adapterRegistry.clear();
}
