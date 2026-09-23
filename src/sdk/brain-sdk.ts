// WEDJAT BRAIN SDK (spec §28, §67) — typed TypeScript HTTP client for the Brain.
//
// Any of the 14 platforms (or any future adapter) uses this SDK to talk to the
// Brain. The SDK is isomorphic (Node + browser): it is a thin HTTP client over
// the Brain's REST surface. It NEVER imports z-ai-web-dev-sdk — the LLM is a
// backend-only component inside the Brain, not something the SDK calls.
//
// Per spec §134: every SDK request carries requestId, applicationId, sdkVersion.
// Per §67: the SDK auto-injects platform identity into every request header
// (X-Brain-Platform) plus X-Brain-SDK-Version.
//
// Spec §28 — Brain SDK surface:
//   brain.respond()       POST /api/brain/respond (full BrainResponse)
//   brain.stream()        POST /api/brain/respond (NDJSON stream, onEvent)
//   brain.retrieve()      POST /api/brain/retrieve
//   brain.remember()      POST /api/brain/memory (create/supersede)
//   brain.evaluate()      POST /api/brain/evaluate
//   brain.publishEvent()  POST /api/brain/events (cross-platform bus, §20)
//   brain.executeTool()   POST /api/brain/tools/execute
//   brain.capabilities()  GET  /api/brain/capabilities
//   brain.health()        GET  /api/brain/health
//   brain.trace()         GET  /api/brain/trace?requestId=...
//   brain.audit()         GET  /api/brain/audit
//   brain.metrics()       GET  /api/brain/metrics

import type {
  BrainRequest,
  BrainResponse,
  BrainStreamEvent,
  EvidenceRef,
  EvidenceStatus,
  ToolResult,
  TraceStep,
  BrainPlatformEvent,
  PlatformEventPipelineState,
} from "@/lib/brain/types";
import {
  streamBrainResponse,
  initialStreamState,
  type BrainStreamState,
  type StreamOptions,
} from "@/lib/brain/client";

export const BRAIN_SDK_VERSION = "0.1.0";

// Re-export all Brain type contracts (§28 — SDK must be the typed surface).
export type {
  BrainRequest,
  BrainResponse,
  BrainStreamEvent,
  EvidenceRef,
  EvidenceStatus,
  ToolResult,
  TraceStep,
  BrainPlatformEvent,
  PlatformEventPipelineState,
};
// Pull in everything else from types.ts as well (BrainMode, IdentityContext,
// MemoryRecord, KnowledgeRecord, ModelDescriptor, ToolDescriptor, etc.).
export * from "@/lib/brain/types";
export type { BrainStreamState, StreamOptions };
export { initialStreamState, streamBrainResponse };

// ---------------------------------------------------------------
// BrainClientOptions
// ---------------------------------------------------------------

export interface BrainClientOptions {
  /**
   * Base URL of the Brain deployment. Defaults to same-origin (browser) or
   * empty (Node — caller must supply baseUrl for cross-process calls).
   * Trailing slash is stripped.
   */
  baseUrl?: string;
  /** Platform slug (e.g. "mashahd", "sgtx"). Sent as X-Brain-Platform on every request (§67). */
  platformSlug?: string;
  /** Application ID — auto-injected into every request body as `applicationId` (§134). */
  applicationId?: string;
  /** Tenant ID — auto-injected into every request body as `tenantId` (§134). */
  tenantId?: string;
  /** Custom fetch implementation (for tests, proxies, undici on older Node). */
  fetch?: typeof fetch;
}

// ---------------------------------------------------------------
// Response shapes (typed return values from the SDK methods).
// ---------------------------------------------------------------

export interface BrainCapabilities {
  brain: string;
  version: string;
  spec: string;
  endpoints: string[];
  domains: string[];
  counts: Record<string, number>;
  principles: string[];
}

export interface BrainHealth {
  state: string;
  checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }>;
  latencyMs: number;
  timestamp: string;
}

export interface BrainTrace {
  run: {
    id: string;
    requestId: string;
    steps: TraceStep[];
    events: BrainStreamEvent[];
    toolExecutions: ToolResult[];
    [k: string]: unknown;
  };
}

export interface BrainAudit {
  events: Array<{
    id: string;
    tenantId: string;
    requestId?: string;
    actorType: string;
    actorId: string;
    action: string;
    target?: string;
    reason?: string;
    severity: string;
    createdAt: string;
  }>;
}

export interface BrainMetrics {
  window: string;
  totals: Record<string, number>;
  latency: { p50: number; p95: number; p99: number };
  byModel: Record<string, { calls: number; cost: number; tokensOut: number; fallbacks: number }>;
  byTool: Record<string, { total: number; verified: number; failed: number }>;
  recentRuns: Array<Record<string, unknown>>;
}

export interface BrainRetrieveResult {
  candidates: Array<{
    kind: "memory" | "knowledge" | "document" | "structured";
    id: string;
    score: number;
    content: string;
    [k: string]: unknown;
  }>;
}

export interface BrainMemoryResult {
  ok?: boolean;
  memory?: Record<string, unknown>;
  error?: string;
  [k: string]: unknown;
}

export interface BrainEvaluateResult {
  setId: string;
  runId: string;
  total: number;
  pass: number;
  fail: number;
  passRate: number;
  results: Array<Record<string, unknown>>;
}

export interface BrainExecuteToolResult {
  result: ToolResult;
}

export interface BrainPublishEventResult {
  ok: boolean;
  eventId: string;
  pipelineState: PlatformEventPipelineState | string;
  duplicate?: boolean;
}

// ---------------------------------------------------------------
// BrainClient
// ---------------------------------------------------------------

type FetchImpl = typeof fetch;

export class BrainClient {
  private readonly baseUrl: string;
  private readonly platformSlug?: string;
  private readonly applicationId?: string;
  private readonly tenantId?: string;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: BrainClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "").replace(/\/+$/, "");
    this.platformSlug = opts.platformSlug;
    this.applicationId = opts.applicationId;
    this.tenantId = opts.tenantId;
    // globalThis.fetch is available in Node 18+ and all modern browsers.
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("BrainClient: no fetch implementation available. Pass `fetch` in options or run in Node 18+ / a modern browser.");
    }
  }

  /** Build the full URL for a path. If baseUrl is empty, returns the path as-is (same-origin). */
  private url(path: string): string {
    return this.baseUrl ? `${this.baseUrl}${path}` : path;
  }

  /** Default headers injected on every request (§67, §134). */
  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Brain-SDK-Version": BRAIN_SDK_VERSION,
    };
    if (this.platformSlug) h["X-Brain-Platform"] = this.platformSlug;
    return { ...h, ...(extra ?? {}) };
  }

  /** Inject SDK identity defaults (applicationId, tenantId) into a request body (§134). */
  private withIdentity<T extends Record<string, unknown>>(body: T): T {
    const merged: Record<string, unknown> = { ...body };
    if (this.applicationId && merged.applicationId === undefined) merged.applicationId = this.applicationId;
    if (this.tenantId && merged.tenantId === undefined) merged.tenantId = this.tenantId;
    return merged as T;
  }

  // -------------------------------------------------------------
  // Streaming primitives
  // -------------------------------------------------------------

  private streamOptions(): StreamOptions {
    return {
      url: this.url("/api/brain/respond"),
      fetchImpl: this.fetchImpl,
      headers: this.headers(),
    };
  }

  // -------------------------------------------------------------
  // POST /api/brain/respond — non-streaming (consumes NDJSON internally).
  // -------------------------------------------------------------

  /** Send a request to the Brain and resolve the full BrainResponse. */
  async respond(req: Partial<BrainRequest>): Promise<BrainResponse> {
    const body = this.withIdentity(req as Record<string, unknown>);
    const result = await streamBrainResponse(body, () => {}, undefined, this.streamOptions());
    if (!result) {
      throw new Error("brain.respond: no response received from /api/brain/respond");
    }
    return result;
  }

  /** Stream a Brain response, invoking `onEvent` for every BrainStreamState snapshot. */
  async stream(
    req: Partial<BrainRequest>,
    onEvent: (state: BrainStreamState) => void,
    signal?: AbortSignal,
  ): Promise<BrainResponse | undefined> {
    const body = this.withIdentity(req as Record<string, unknown>);
    return streamBrainResponse(body, onEvent, signal, this.streamOptions());
  }

  // -------------------------------------------------------------
  // POST /api/brain/retrieve — explicit hybrid retrieval (§34).
  // -------------------------------------------------------------

  async retrieve(input: {
    text: string;
    tenantId?: string;
    applicationId?: string;
    userId?: string;
    topK?: number;
  }): Promise<BrainRetrieveResult> {
    const body = this.withIdentity(input as Record<string, unknown>);
    return this.postJson<BrainRetrieveResult>("/api/brain/retrieve", body);
  }

  // -------------------------------------------------------------
  // POST /api/brain/memory — memory management (§20, §167).
  // -------------------------------------------------------------

  async remember(input: {
    action: "create" | "promote" | "supersede" | "delete";
    tenantId?: string;
    applicationId?: string;
    userId?: string;
    domain?: string;
    type?: string;
    scope?: string;
    content?: string;
    memoryId?: string;
    newContent?: string;
    reason?: string;
  }): Promise<BrainMemoryResult> {
    const body = this.withIdentity(input as Record<string, unknown>);
    return this.postJson<BrainMemoryResult>("/api/brain/memory", body);
  }

  // -------------------------------------------------------------
  // POST /api/brain/evaluate — golden evaluation (§86-92).
  // -------------------------------------------------------------

  async evaluate(input: {
    setId?: string;
    tenantId?: string;
    applicationId?: string;
    userId?: string;
  }): Promise<BrainEvaluateResult> {
    const body = this.withIdentity(input as Record<string, unknown>);
    return this.postJson<BrainEvaluateResult>("/api/brain/evaluate", body);
  }

  // -------------------------------------------------------------
  // POST /api/brain/events — cross-platform event bus (§20, §68-70).
  // Accepts a single event or a batch (array).
  // -------------------------------------------------------------

  async publishEvent(event: BrainPlatformEvent): Promise<BrainPublishEventResult>;
  async publishEvent(events: BrainPlatformEvent[]): Promise<BrainPublishEventResult[]>;
  async publishEvent(
    eventOrEvents: BrainPlatformEvent | BrainPlatformEvent[],
  ): Promise<BrainPublishEventResult | BrainPublishEventResult[]> {
    const isBatch = Array.isArray(eventOrEvents);
    const body = isBatch
      ? (eventOrEvents as BrainPlatformEvent[]).map((e) => this.withIdentity(e as unknown as Record<string, unknown>))
      : this.withIdentity(eventOrEvents as unknown as Record<string, unknown>);
    const res = await this.fetchImpl(this.url("/api/brain/events"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`brain.publishEvent: ${res.status} ${text}`);
    }
    return res.json() as Promise<BrainPublishEventResult | BrainPublishEventResult[]>;
  }

  // -------------------------------------------------------------
  // POST /api/brain/tools/execute — governed tool execution (§52).
  // -------------------------------------------------------------

  async executeTool(input: {
    toolId: string;
    input: Record<string, unknown>;
    tenantId?: string;
    applicationId?: string;
    userId?: string;
    runId?: string;
  }): Promise<BrainExecuteToolResult> {
    const body = this.withIdentity(input as Record<string, unknown>);
    return this.postJson<BrainExecuteToolResult>("/api/brain/tools/execute", body);
  }

  // -------------------------------------------------------------
  // GET endpoints
  // -------------------------------------------------------------

  /** GET /api/brain/capabilities — Brain capability manifest (§13). */
  async capabilities(): Promise<BrainCapabilities> {
    return this.getJson<BrainCapabilities>("/api/brain/capabilities");
  }

  /** GET /api/brain/health — Brain self-diagnostics (§110, §198). */
  async health(): Promise<BrainHealth> {
    return this.getJson<BrainHealth>("/api/brain/health");
  }

  /** GET /api/brain/trace?requestId=... — request trace view (§73, §128). */
  async trace(requestId: string): Promise<BrainTrace> {
    return this.getJson<BrainTrace>(`/api/brain/trace?requestId=${encodeURIComponent(requestId)}`);
  }

  /** GET /api/brain/audit — audit log (§129, §130). */
  async audit(limit = 50): Promise<BrainAudit> {
    return this.getJson<BrainAudit>(`/api/brain/audit?limit=${limit}`);
  }

  /** GET /api/brain/metrics — observability dashboard data (§127). */
  async metrics(): Promise<BrainMetrics> {
    return this.getJson<BrainMetrics>("/api/brain/metrics");
  }

  // -------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(this.url(path), { method: "GET", headers: this.headers() });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`brain GET ${path}: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(this.url(path), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`brain POST ${path}: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }
}

// ---------------------------------------------------------------
// Factory + default client
// ---------------------------------------------------------------

/**
 * Create a Brain client. If no baseUrl is provided the client targets the
 * same origin (useful inside the WEDJAT workspace itself or from a browser
 * served by the Brain deployment).
 *
 * @example
 *   const brain = createBrainClient({
 *     baseUrl: "https://brain.wedjat.ai",
 *     platformSlug: "mashahd",
 *     applicationId: "app_xxx",
 *     tenantId: "tnt_xxx",
 *   });
 *   const res = await brain.respond({ input: { text: "What can you do?" } });
 */
export function createBrainClient(opts: BrainClientOptions = {}): BrainClient {
  return new BrainClient(opts);
}

/**
 * Default same-origin client. Convenient for in-app callers (e.g. a React
 * component, server action, or route handler running inside the Brain
 * deployment itself). Cross-process callers should construct their own client
 * via `createBrainClient({ baseUrl })`.
 */
export const brain: BrainClient = createBrainClient({});

export default brain;
