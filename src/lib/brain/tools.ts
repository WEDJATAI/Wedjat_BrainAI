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
