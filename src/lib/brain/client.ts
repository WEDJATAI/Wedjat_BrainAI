// Client-side Brain stream parser + API helpers.
// Used by the widget components. Never imports z-ai-web-dev-sdk (backend-only).

import type { BrainStreamEvent, BrainResponse, EvidenceRef, TraceStep, ToolResult, EvidenceStatus } from "./types";

export interface BrainStreamState {
  trace: TraceStep[];
  tokens: string;
  evidence: EvidenceRef[];
  memory: Array<{ id: string; content: string; type: string; scope: string }>;
  model?: { model: string; provider: string; fallbackUsed: boolean; reason?: string };
  tools: ToolResult[];
  verification?: { status: EvidenceStatus; reason?: string };
  cost?: { tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number };
  learning?: { candidateId: string; category: string; preview: string };
  response?: BrainResponse;
  error?: { message: string; code?: string };
  done: boolean;
}

export function initialStreamState(): BrainStreamState {
  return { trace: [], tokens: "", evidence: [], memory: [], tools: [], done: false };
}

/** Options for streamBrainResponse — allows the Brain SDK to target a remote Brain. */
export interface StreamOptions {
  /** Absolute URL or path. Defaults to same-origin "/api/brain/respond". */
  url?: string;
  /** Custom fetch implementation (Node 18+ has fetch native; this is for tests/proxies). */
  fetchImpl?: typeof fetch;
  /** Extra headers (e.g. X-Brain-Platform, X-Brain-SDK-Version). */
  headers?: Record<string, string>;
}

/** Parse an NDJSON stream from /api/brain/respond and invoke the callback per event. */
export async function streamBrainResponse(
  body: unknown,
  onState: (state: BrainStreamState) => void,
  signal?: AbortSignal,
  options?: StreamOptions,
): Promise<BrainResponse | undefined> {
  const state = initialStreamState();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = options?.url ?? "/api/brain/respond";
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options?.headers ?? {}) };
  const res = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => res.statusText);
    state.error = { message: `request failed: ${res.status} ${text}` };
    onState({ ...state });
    return undefined;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let ev: BrainStreamEvent;
      try { ev = JSON.parse(trimmed) as BrainStreamEvent; } catch { continue; }
      applyEvent(state, ev);
      onState({ ...state, trace: [...state.trace], evidence: [...state.evidence], memory: [...state.memory], tools: [...state.tools] });
    }
  }
  return state.response;
}

function applyEvent(state: BrainStreamState, ev: BrainStreamEvent) {
  switch (ev.type) {
    case "trace":
      // For STARTED then COMPLETED of same step, update; otherwise append.
      {
        const existingIdx = state.trace.findIndex(
          (t) => t.stepType === ev.step.stepType && t.stepName === ev.step.stepName && ev.step.status === "COMPLETED",
        );
        if (existingIdx >= 0) state.trace[existingIdx] = ev.step;
        else state.trace.push(ev.step);
      }
      break;
    case "token": state.tokens += ev.delta; break;
    case "evidence": state.evidence = ev.evidence; break;
    case "memory": state.memory = ev.memory; break;
    case "model": state.model = { model: ev.model, provider: ev.provider, fallbackUsed: ev.fallbackUsed, reason: ev.reason }; break;
    case "tool": state.tools = [...state.tools, ev.tool]; break;
    case "verification": state.verification = { status: ev.status, reason: ev.reason }; break;
    case "cost": state.cost = { tokensIn: ev.tokensIn, tokensOut: ev.tokensOut, costUsd: ev.costUsd, latencyMs: ev.latencyMs }; break;
    case "learning": state.learning = { candidateId: ev.candidateId, category: ev.category, preview: ev.preview }; break;
    case "done": state.response = ev.response; state.done = true; break;
    case "error": state.error = { message: ev.message, code: ev.code }; state.done = true; break;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
}
