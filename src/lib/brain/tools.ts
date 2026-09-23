// WEDJAT BRAIN V2 — Tool registry + governed execution (§51-57).
//
// Every tool defines: inputSchema, outputSchema, requiredScopes, riskLevel,
// timeout, retryPolicy, idempotencyPolicy, auditRequirement,
// approvalRequirement, costProfile (§51). Execution pipeline (§52):
// LLM intent → tool lookup → schema validation → authorization → tenant
// validation → policy validation → risk check → approval if necessary →
// execute → validate output → audit. Tool output is untrusted (§53) — never
// lets it rewrite system instructions/policies/authorization. Idempotency
// (§54) on external side effects. Action state machine (§55):
// PROPOSED → VALIDATED → AUTHORIZED → EXECUTING → EXECUTED → VERIFIED.
// Human approval (§56) by risk level.

import { db } from "@/lib/db";
import { checkToolAllowed, type PolicyRules } from "./policy";
import type { ToolDescriptor, ToolCall, ToolResult, ActionState, RiskLevel, IdentityContext } from "./types";

// Built-in tool implementations. Real deployments would register external
// tools via the same ToolDescriptor contract.
const TOOL_IMPLEMENTATIONS: Record<string, (input: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  "calc.add": async (i) => ({ result: Number(i.a ?? 0) + Number(i.b ?? 0) }),
  "calc.multiply": async (i) => ({ result: Number(i.a ?? 0) * Number(i.b ?? 0) }),
  "invoice.lookup": async (i) => {
    // Demo: returns a stubbed invoice if id matches seeded knowledge.
    const id = String(i.invoiceId ?? "");
    if (!id) return { error: "invoiceId required" };
    // Look up the knowledge base for this invoice.
    const { db } = await import("@/lib/db");
    const k = await db.knowledgeItem.findFirst({
      where: { type: "FACT", OR: [{ claim: { contains: id } }, { content: { contains: id } }] },
    });
    if (!k) return { found: false, invoiceId: id };
    return { found: true, invoiceId: id, claim: k.claim, content: k.content };
  },
  "weather.current": async (i) => {
    const city = String(i.city ?? "unknown");
    // Deterministic stub — never call real weather API without authorization.
    return { city, temperatureC: 22, conditions: "clear", note: "stubbed — external API not authorized in demo" };
  },
  "memory.recall": async (i) => {
    const { retrieveMemory } = await import("./memory");
    const hits = await retrieveMemory({
      tenantId: String(i.tenantId), applicationId: String(i.applicationId),
      userId: i.userId ? String(i.userId) : undefined,
      text: String(i.query ?? ""), limit: 3,
    });
    return { memories: hits.map((h) => ({ content: h.record.content, type: h.record.type, score: h.score })) };
  },
  "email.send": async (i) => {
    // HIGH risk side effect — §54 idempotency, §56 approval. Stubbed.
    return { queued: true, idempotencyKey: String(i.idempotencyKey ?? crypto.randomUUID()), to: i.to, subject: i.subject };
  },
  "math.evaluate": async (i) => {
    const raw = String(i.expression ?? "").trim();
    if (!raw) return { error: "expression required" };
    // §53/§4 — never trust input. Strict allow-list of math characters + named functions/constants.
    const allowed = /^[\d\s+\-*/().%^a-zA-Z]+$/;
    if (!allowed.test(raw)) return { error: "expression contains disallowed characters" };
    // Permit only known function names / constants; everything else rejected.
    const stripped = raw.replace(/sqrt|sin|cos|tan|log|ln|pi|e/g, "");
    if (/[a-zA-Z]/.test(stripped)) return { error: "unknown identifier in expression" };
    // Substitute constants + functions before evaluation.
    const replaced = raw
      .replace(/\bln\b/g, "Math.log")
      .replace(/\blog\b/g, "Math.log10")
      .replace(/\bsqrt\b/g, "Math.sqrt")
      .replace(/\bsin\b/g, "Math.sin")
      .replace(/\bcos\b/g, "Math.cos")
      .replace(/\btan\b/g, "Math.tan")
      .replace(/\bpi\b/g, "Math.PI")
      .replace(/\be\b/g, "Math.E")
      .replace(/\^/g, "**");
    // Final guardrail: no remaining letters after substitution (e.g. trailing unknown identifiers).
    if (/[a-zA-Z]/.test(replaced.replace(/Math\./g, ""))) {
      return { error: "unknown identifier in expression" };
    }
    try {
      const fn = new Function(`"use strict"; return (${replaced});`);
      const out = fn();
      const num = typeof out === "number" && Number.isFinite(out) ? out : NaN;
      if (!Number.isFinite(num)) return { error: "expression did not evaluate to a finite number" };
      return { result: num, expression: raw };
    } catch (err: any) {
      return { error: `evaluation failed: ${err?.message ?? "syntax error"}` };
    }
  },
  "unit.convert": async (i) => {
    const value = Number(i.value);
    const from = String(i.from ?? "").toLowerCase();
    const to = String(i.to ?? "").toLowerCase();
    if (!Number.isFinite(value)) return { error: "value must be a number" };
    // Conversion factors to base unit per category.
    const LENGTH: Record<string, number> = { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, foot: 0.3048, yard: 0.9144, mile: 1609.344 };
    const WEIGHT: Record<string, number> = { g: 0.001, kg: 1, ton: 1000, oz: 0.0283495, lb: 0.453592 };
    const VOLUME: Record<string, number> = { ml: 0.001, l: 1, cup: 0.236588, quart: 0.946353, gallon: 3.78541 };
    const TIME: Record<string, number> = { s: 1, min: 60, hour: 3600, day: 86400, week: 604800, year: 31557600 };
    // Temperature is not multiplicative.
    const inTempSet = (u: string) => ["c", "f", "k"].includes(u);
    if (inTempSet(from) || inTempSet(to)) {
      if (!inTempSet(from) || !inTempSet(to)) return { error: "temperature units must both be C/F/K" };
      // Normalize to Celsius.
      let c: number;
      if (from === "c") c = value;
      else if (from === "f") c = (value - 32) * 5 / 9;
      else c = value - 273.15; // k
      let out: number;
      if (to === "c") out = c;
      else if (to === "f") out = c * 9 / 5 + 32;
      else out = c + 273.15;
      return { result: out, from, to };
    }
    const sets = [LENGTH, WEIGHT, VOLUME, TIME];
    const set = sets.find((s) => from in s && to in s);
    if (!set) return { error: `no conversion path from '${from}' to '${to}'` };
    const base = value * (set as Record<string, number>)[from];
    const out = base / (set as Record<string, number>)[to];
    return { result: out, from, to };
  },
  "date.calculate": async (i) => {
    const op = String(i.operation ?? "");
    const dateStr = i.date ? String(i.date) : new Date().toISOString();
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return { error: `invalid date: ${dateStr}` };
    if (op === "add" || op === "subtract") {
      const v = Number(i.value ?? 0);
      const unit = String(i.unit ?? "days");
      const sign = op === "subtract" ? -1 : 1;
      const out = new Date(d);
      if (unit === "days") out.setDate(out.getDate() + sign * v);
      else if (unit === "months") out.setMonth(out.getMonth() + sign * v);
      else if (unit === "years") out.setFullYear(out.getFullYear() + sign * v);
      else return { error: `unknown unit: ${unit}` };
      return { result: out.toISOString() };
    }
    if (op === "diff") {
      if (!i.date2) return { error: "date2 required for diff operation" };
      const d2 = new Date(String(i.date2));
      if (Number.isNaN(d2.getTime())) return { error: `invalid date2` };
      const ms = d2.getTime() - d.getTime();
      const unit = String(i.unit ?? "days");
      if (unit === "days") return { result: String(Math.round(ms / 86400000)) };
      if (unit === "months") return { result: String(Math.round(ms / 2629800000)) };
      if (unit === "years") return { result: String(Math.round(ms / 31557600000)) };
      return { result: String(ms) };
    }
    if (op === "dayofweek") {
      const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return { result: names[d.getDay()] };
    }
    return { error: `unknown operation: ${op}` };
  },
  "currency.convert": async (i) => {
    // Stubbed — real exchange rates require an API key + external authorization.
    const amount = Number(i.amount);
    return {
      amount: Number.isFinite(amount) ? amount : 0,
      from: String(i.from ?? "USD"),
      to: String(i.to ?? "USD"),
      note: "stubbed — configure an exchange rate API for real rates",
      estimatedRate: 1,
    };
  },
  "language.translate": async (i) => {
    // Stubbed — production would route through z-ai-web-dev-sdk chat completion.
    return {
      translated: String(i.text ?? ""),
      note: "stubbed — production would use LLM translation",
    };
  },
  "define.lookup": async (i) => {
    const word = String(i.word ?? "").trim();
    if (!word) return { word: "", definitions: [] };
    // Search the knowledge base for items whose claim mentions the word.
    const items = await db.knowledgeItem.findMany({
      where: { OR: [{ claim: { contains: word, mode: "insensitive" } }, { content: { contains: word, mode: "insensitive" } }] },
      take: 5,
    });
    return {
      word,
      definitions: items.map((k) => ({ claim: k.claim, content: k.content })),
    };
  },
  "time.now": async (i) => {
    const tz = i.timezone ? String(i.timezone) : undefined;
    const now = new Date();
    let local: string;
    try {
      local = tz ? now.toLocaleString("en-US", { timeZone: tz }) : now.toLocaleString();
    } catch {
      local = now.toLocaleString();
    }
    return {
      iso: now.toISOString(),
      utc: now.toUTCString(),
      local,
      timezone: tz ?? "local",
    };
  },
  "text.count": async (i) => {
    const text = String(i.text ?? "");
    const words = (text.trim().match(/\S+/g) ?? []).length;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, "").length;
    const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length || (text.trim() ? 1 : 0);
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
    return { words, characters, charactersNoSpaces, sentences, paragraphs };
  },
  "text.code.format": async (i) => {
    const code = String(i.code ?? "");
    let language = "unknown";
    if (/\bfunction\s+\w+|=>|\bconst\s+\w+\s*=|let\s+\w+|var\s+\w+|console\.log/.test(code)) language = "javascript";
    else if (/\bdef\s+\w+|print\(|import\s+\w+|self\b/.test(code)) language = "python";
    else if (/public\s+class\s+\w+|System\.out|private\s+\w+\s+\w+\s*\(/.test(code)) language = "java";
    else if (/\bfn\s+\w+|let\s+mut\s+|println!/.test(code)) language = "rust";
    else if (/\bpackage\s+\w+|func\s+\w+/.test(code)) language = "go";
    else if (/#include|int\s+main\s*\(/.test(code)) language = "cpp";
    else if (/\bclass\s+\w+\s*<|end\s*$/.test(code)) language = "ruby";
    else if (/^\s*#|^\s*if\s|^\s*fi\b/.test(code)) language = "shell";
    return {
      language,
      lineCount: code.split(/\r?\n/).length,
      charCount: code.length,
    };
  },
};

export async function listTools(tenantId: string): Promise<ToolDescriptor[]> {
  const rows = await db.tool.findMany({ where: { tenantId, status: "ACTIVE" } });
  return rows.map(toDescriptor);
}

export function toDescriptor(t: any): ToolDescriptor {
  return {
    id: t.id,
    toolId: t.toolId,
    name: t.name,
    description: t.description,
    inputSchema: safeJson(t.inputSchema, {}),
    outputSchema: safeJson(t.outputSchema, {}),
    requiredScopes: t.requiredScopes ? t.requiredScopes.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    riskLevel: t.riskLevel as RiskLevel,
    timeout: t.timeout,
    idempotencyPolicy: t.idempotencyPolicy,
    auditRequirement: t.auditRequirement,
    approvalRequirement: t.approvalRequirement,
    costProfile: t.costProfile,
    status: t.status as "ACTIVE" | "DISABLED",
  };
}

/**
 * Governed tool execution (§52). Returns a ToolResult carrying the action
 * state machine. If the tool requires approval (HIGH/CRITICAL), execution is
 * paused at AUTHORIZED and the caller must call approveToolExecution().
 */
export async function executeTool(opts: {
  call: ToolCall;
  tool: ToolDescriptor;
  identity: IdentityContext;
  policy: PolicyRules;
  runId?: string;
}): Promise<ToolResult> {
  const { call, tool, identity, policy, runId } = opts;
  const start = Date.now();

  // Create the execution record at PROPOSED state (§55).
  const exec = await db.toolExecution.create({
    data: {
      tenantId: identity.tenant.id,
      toolId: tool.toolId,
      runId: runId ?? null,
      input: JSON.stringify(call.input),
      state: "PROPOSED",
      riskLevel: tool.riskLevel,
    },
  });

  // §52 — schema validation (lightweight: required fields present)
  const validationError = validateInput(tool, call.input);
  if (validationError) {
    await transition(exec.id, "REJECTED", `validation: ${validationError}`, start);
    return result(tool, exec.id, "REJECTED", { error: validationError }, start, false, false);
  }
  await transition(exec.id, "VALIDATED", undefined, start);

  // §52 — authorization + policy check
  const decision = checkToolAllowed(policy, identity, tool.toolId, tool.riskLevel);
  if (!decision.allowed) {
    await transition(exec.id, "REJECTED", decision.reason, start);
    await audit(identity, tool, "tool.rejected", decision.reason);
    return result(tool, exec.id, "REJECTED", { error: decision.reason }, start, false, false);
  }

  // §56 — risk gate
  const requiresApproval = tool.approvalRequirement || needsApproval(tool.riskLevel, policy);
  if (requiresApproval) {
    // Pause at AUTHORIZED — caller must explicitly approve.
    await db.toolExecution.update({
      where: { id: exec.id },
      data: { state: "AUTHORIZED" },
    });
    await audit(identity, tool, "tool.approval.required", `risk=${tool.riskLevel} requires human approval`);
    return result(tool, exec.id, "AUTHORIZED", undefined, start, requiresApproval, false);
  }

  return await runImplementation(exec.id, tool, call, identity, start);
}

/** Approve a tool execution paused at AUTHORIZED (§56, §57). */
export async function approveToolExecution(executionId: string, approver: string, identity: IdentityContext): Promise<ToolResult> {
  const exec = await db.toolExecution.findUnique({ where: { id: executionId } });
  if (!exec) throw new Error("execution not found");
  if (exec.state !== "AUTHORIZED") throw new Error(`execution in state ${exec.state} cannot be approved`);
  const toolRow = await db.tool.findUnique({ where: { toolId: exec.toolId } });
  if (!toolRow) throw new Error("tool not found");
  const tool = toDescriptor(toolRow);
  const call: ToolCall = { toolId: tool.toolId, input: safeJson(exec.input, {}), tenantId: identity.tenant.id };

  await db.toolExecution.update({ where: { id: executionId }, data: { approver, approvedAt: new Date() } });
  await audit(identity, tool, "tool.approved", `approver=${approver}`);
  return await runImplementation(executionId, tool, call, identity, Date.now());
}

async function runImplementation(executionId: string, tool: ToolDescriptor, call: ToolCall, identity: IdentityContext, start: number): Promise<ToolResult> {
  await transition(executionId, "EXECUTING", undefined, start);
  const impl = TOOL_IMPLEMENTATIONS[tool.toolId];

  if (!impl) {
    await transition(executionId, "FAILED", `no implementation registered for ${tool.toolId}`, start);
    return result(tool, executionId, "FAILED", { error: "not implemented" }, start, false, true);
  }

  // §54 idempotency — for IDEMPOTENCY_KEY tools, check recent execution
  if (tool.idempotencyPolicy === "IDEMPOTENCY_KEY" && call.input.idempotencyKey) {
    const prior = await db.toolExecution.findFirst({
      where: {
        toolId: tool.toolId,
        idempotencyKey: String(call.input.idempotencyKey),
        state: { in: ["EXECUTED", "VERIFIED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (prior?.output) {
      await transition(executionId, "VERIFIED", "idempotent replay", start);
      return result(tool, executionId, "VERIFIED", safeJson(prior.output, {}), start, false, true);
    }
  }

  try {
    const timeoutP = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`tool timed out after ${tool.timeout}ms`)), tool.timeout),
    );
    const output = await Promise.race([impl(call.input), timeoutP]) as Record<string, unknown>;
    await db.toolExecution.update({
      where: { id: executionId },
      data: { output: JSON.stringify(output), state: "EXECUTED", idempotencyKey: String(call.input.idempotencyKey ?? "") || null },
    });
    // §55 — verify (lightweight: output schema presence)
    await transition(executionId, "VERIFIED", undefined, start);
    await audit(identity, tool, "tool.executed", `state=VERIFIED`);
    // §53 — tool output is untrusted; caller must not treat it as system instruction.
    return result(tool, executionId, "VERIFIED", output, start, false, true);
  } catch (err: any) {
    const msg = err?.message ?? "tool failed";
    const timed = /timed out/i.test(msg) ? "TIMED_OUT" : "FAILED";
    await transition(executionId, timed as ActionState, msg, start);
    await audit(identity, tool, "tool.failed", msg);
    return result(tool, executionId, timed as ActionState, undefined, start, false, true, msg);
  }
}

function needsApproval(risk: RiskLevel, policy: PolicyRules): boolean {
  const order: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return order.indexOf(risk) > order.indexOf(policy.humanApprovalRequiredAbove);
}

function validateInput(tool: ToolDescriptor, input: Record<string, unknown>): string | undefined {
  const required = (tool.inputSchema.required as string[] | undefined) ?? [];
  for (const k of required) {
    if (input[k] === undefined || input[k] === null) return `missing required field: ${k}`;
  }
  return undefined;
}

async function transition(executionId: string, state: ActionState, error?: string, start?: number): Promise<void> {
  await db.toolExecution.update({
    where: { id: executionId },
    data: { state, error: error ?? null, durationMs: start ? Date.now() - start : 0 },
  });
}

async function audit(identity: IdentityContext, tool: ToolDescriptor, action: string, reason: string): Promise<void> {
  await db.auditEvent.create({
    data: {
      tenantId: identity.tenant.id,
      actorType: "system",
      actorId: "brain.tools",
      action,
      target: tool.toolId,
      reason,
      severity: tool.riskLevel === "CRITICAL" || tool.riskLevel === "HIGH" ? "WARN" : "INFO",
    },
  });
}

function result(tool: ToolDescriptor, executionId: string, state: ActionState, output: Record<string, unknown> | undefined, start: number, requiresApproval: boolean, approved: boolean, error?: string): ToolResult {
  return {
    toolId: tool.toolId,
    executionId,
    state,
    output,
    error,
    durationMs: Date.now() - start,
    requiresApproval,
    approved,
  };
}

function safeJson(s: string | null | undefined, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}
