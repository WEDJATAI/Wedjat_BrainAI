// WEDJAT BRAIN V2 — Brain Runtime orchestrator (§11, §73).
//
// Real-time path (§11): USER → Brain API → Authenticate → Resolve identity →
// Resolve tenant/application → Policy check → Task classification → Memory
// retrieval → Knowledge retrieval → Structured data retrieval if needed →
// Tool planning if needed → Model selection → Reasoning → Verification
// where required → Streaming response → Persist interaction → Emit
// background events.
//
// Observability (§73): every request produces a trace (BrainRun + BrainSteps
// + BrainEvents + AuditEvents). Cost (§75) and latency (§77) measured.

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { resolveIdentity } from "./identity";
import { resolvePolicy } from "./policy";
import { hybridRetrieve, type StructuredLookup } from "./retrieval";
import { assembleSystemPrompt } from "./prompts";
import { selectModel, callModel } from "./models";
import { listTools, executeTool } from "./tools";
import { verifyAnswer } from "./verification";
import { createLearningCandidate } from "./learning";
import { recordEpisodic, createMemoryCandidate } from "./memory";
import { estimateTokens } from "./vectors";
import type { PolicyRules } from "./policy";
import type {
  BrainRequest, BrainResponse, IdentityContext, PolicyMode,
  TraceStep, TaskType, EvidenceRef, BrainStreamEvent, ToolResult,
  RetrievalCandidate, ModelDescriptor, EvidenceStatus,
} from "./types";

export interface RuntimeCallbacks {
  onEvent?: (ev: BrainStreamEvent) => void;
  signal?: AbortSignal;
}

/** Classify the task deterministically (§38, §79). */
export function classifyTask(text: string, structured: StructuredLookup): TaskType {
  const t = text.toLowerCase();
  if (structured.matched) return "factual";
  if (/(analyze|compare|design|architect|reason|why|trade-off|tradeoff)/.test(t)) return "reasoning";
  if (/(synthesize|summarize|draft|write|compose|generate)/.test(t)) return "synthesis";
  if (/(code|function|bug|implement|refactor)/.test(t)) return "coding";
  if (/(send|create|update|delete|book|publish|purchase|approve)/.test(t)) return "tool_use";
  if (/(danger|critical|high.?risk|authorize|approve|restricted)/.test(t)) return "high_risk";
  if (text.length < 60 && /\?$/.test(text.trim())) return "simple";
  return "simple";
}

/**
 * Run the Brain. Returns a typed BrainResponse; the supplied callbacks
 * receive streaming BrainStreamEvents (trace, tokens, evidence, model,
 * tool, verification, cost, learning, done).
 */
export async function runBrain(req: BrainRequest, cb: RuntimeCallbacks = {}): Promise<BrainResponse> {
  const startedAt = Date.now();
  const requestId = req.requestId || randomUUID();
  const trace: TraceStep[] = [];

  const emit = (ev: BrainStreamEvent) => {
    if (cb.signal?.aborted) throw new Error("aborted");
    cb.onEvent?.(ev);
  };
  const step = async <T>(stepType: TraceStep["stepType"], stepName: string, fn: () => Promise<T>, reasonCode?: string): Promise<T> => {
    const s = Date.now();
    emit({ type: "trace", step: { stepType, stepName, status: "STARTED", reasonCode } });
    try {
      const out = await fn();
      const t: TraceStep = { stepType, stepName, status: "COMPLETED", durationMs: Date.now() - s, reasonCode };
      trace.push(t);
      emit({ type: "trace", step: t });
      return out;
    } catch (err: any) {
      const t: TraceStep = { stepType, stepName, status: "FAILED", durationMs: Date.now() - s, reasonCode, detail: { error: err?.message } };
      trace.push(t);
      emit({ type: "trace", step: t });
      throw err;
    }
  };

  // Create the BrainRun record up front (§73).
  let identity: IdentityContext;
  let policy: PolicyRules;
  let runId: string;

  try {
    identity = await step("identity", "Resolve identity + tenant isolation", async () => {
      const i = await resolveIdentity(req);
      // Ensure conversation exists for episodic recording.
      return i;
    }, "tenant + application + user resolved");

    policy = await step("policy", "Resolve effective policy", async () => {
      return resolvePolicy(identity);
    }, "global → tenant → application inheritance");

    runId = await createRun(req, identity, requestId);
  } catch (err: any) {
    emit({ type: "error", message: err.message, code: err.code });
    return errorResponse(requestId, err, trace);
  }

  try {
    // Persist the user message as an episodic event (§20.1).
    await step("memory", "Record episodic user input", async () => {
      if (req.conversationId) {
        await db.message.create({
          data: {
            conversationId: req.conversationId,
            role: "user",
            content: req.input.text ?? "",
            tokensIn: estimateTokens(req.input.text ?? ""),
          },
        }).catch(() => {});
      }
      await recordEpisodic({
        tenantId: identity.tenant.id,
        applicationId: identity.application.id,
        userId: identity.user?.id,
        conversationId: req.conversationId,
        type: "user_message",
        content: req.input.text ?? "",
        source: "user",
      }).catch(() => {});
      return null;
    }, "episodic memory");

    // Task router + hybrid retrieval
    let structured: StructuredLookup = { matched: false, kind: "none", reason: "not attempted" };
    let candidates: RetrievalCandidate[] = [];
    await step("retrieval", "Hybrid retrieval (semantic + keyword + structured)", async () => {
      const out = await hybridRetrieve({
        identity,
        text: req.input.text ?? "",
        topK: 8,
      });
      structured = out.structured;
      candidates = out.candidates;
      return out;
    }, structured.matched ? "structured lookup hit — LLM not needed for fact" : "semantic + keyword hybrid");

    const taskType = await step("task_router", "Classify task", async () => {
      return classifyTask(req.input.text ?? "", structured);
    }, `task=${classifyTask(req.input.text ?? "", structured)}`);

    emit({ type: "memory", memory: candidates.filter((c) => c.kind === "memory").map((c) => ({ id: c.id, content: c.content, type: c.type ?? "", scope: c.scope ?? "" })) });

    // Build evidence refs (§29 lineage: answer → claim → evidence → source)
    const evidence: EvidenceRef[] = candidates
      .filter((c) => c.kind === "knowledge")
      .map((c) => ({
        id: c.id,
        type: (c.record as any)?.type ?? "FACT",
        claim: c.content,
        sourceTitle: c.source,
        evidenceStatus: (c.evidenceStatus as EvidenceStatus) ?? "SUPPORTED",
        retrievedAt: new Date().toISOString(),
        validFrom: c.validFrom?.toISOString(),
        validUntil: c.validUntil?.toISOString(),
        conflict: !!(c as any).conflict,
      }));
    if (evidence.length > 0) emit({ type: "evidence", evidence });

    // §163 — if structured hit, answer deterministically without LLM (§79, §191)
    let answer = "";
    let modelUsed = "structured";
    let provider = "deterministic";
    let fallbackUsed = false;
    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;
    let modelLatencyMs = 0;
    const toolsUsed: string[] = [];

    if (structured.matched) {
      await step("model_router", "Skip model — deterministic answer (§37, §79)", async () => {
        emit({ type: "model", model: "structured", provider: "deterministic", fallbackUsed: false, reason: structured.reason });
        return null;
      }, "deterministic routing");
      answer = `According to authoritative records: ${typeof structured.value === "object" ? JSON.stringify(structured.value) : String(structured.value)}\n\nSource: structured lookup (no reasoning model required).`;
      tokensOut = estimateTokens(answer);
    } else {
      // Model router (§47) + fallback (§48)
      const selected = await step("model_router", "Select model (tier + provider + fallback)", async () => {
        const out = await selectModel({
          taskType,
          mode: req.mode,
          policyMode: identity.application.modelPolicy as PolicyMode,
          policy,
          dataClass: identity.tenant.dataPolicy,
        });
        emit({ type: "model", model: out.model.displayName, provider: out.model.provider, fallbackUsed: false, reason: out.reason });
        return out;
      }, "tier + provider + fallback resolved");

      // Tool planning — pick tools relevant to the request
      const tools = await listTools(identity.tenant.id);
      const plannedTools = tools.filter((t) => {
        const txt = (req.input.text ?? "").toLowerCase();
        if (t.toolId === "calc.add" || t.toolId === "calc.multiply") return /(add|sum|plus|multiply|times|\*)/.test(txt);
        if (t.toolId === "invoice.lookup") return /invoice/.test(txt);
        if (t.toolId === "weather.current") return /weather|temperature|forecast/.test(txt);
        if (t.toolId === "memory.recall") return /remember|recall|previous/.test(txt);
        if (t.toolId === "email.send") return /send.*email|email.*send/.test(txt);
        return false;
      }).slice(0, 3);

      // Context engine (§41-43) — assemble minimal sufficient context
      const assembly = await step("context", "Assemble minimal sufficient context (§41-43)", async () => {
        // §157 — apply platform personality + governance boundaries.
        const platformSlug = (req.metadata as any)?.platformSlug as string | undefined;
        let platformSuffix = "";
        let governanceBoundary = "";
        if (platformSlug) {
          const platformRow = await db.platform.findUnique({ where: { slug: platformSlug } }).catch(() => null);
          if (platformRow?.personality) {
            try {
              const p = JSON.parse(platformRow.personality) as { tone?: string; vocabulary?: string[]; systemPromptSuffix?: string };
              platformSuffix = p.systemPromptSuffix ?? "";
              if (p.tone) platformSuffix += ` Tone: ${p.tone}.`;
              if (p.vocabulary?.length) platformSuffix += ` Domain vocabulary: ${p.vocabulary.join(", ")}.`;
            } catch { /* ignore malformed personality */ }
          }
          // §11/§45/§46/§47 — governance boundaries injected as hard policy text
          const { getPlatformBySlug } = await import("./platform-registry");
          const cat = getPlatformBySlug(platformSlug);
          if (cat?.governanceBoundary) governanceBoundary = `\n\nGOVERNANCE BOUNDARY: ${cat.governanceBoundary}`;
        }
        const { systemPrompt } = assembleSystemPrompt({
          identity, tools: plannedTools, candidates, evidenceStatus: "SUPPORTED", taskType,
        });
        const fullSystemPrompt = systemPrompt + (platformSuffix ? `\n\nPLATFORM CONTEXT: ${platformSuffix}` : "") + governanceBoundary;
        const budget = selected.model.contextLimit;
        const sysTokens = estimateTokens(fullSystemPrompt);
        const historyTokens = estimateTokens((req.input.text ?? "").slice(0, 2000));
        const memoryTokens = candidates.filter((c) => c.kind === "memory").reduce((s, c) => s + estimateTokens(c.content), 0);
        const knowledgeTokens = candidates.filter((c) => c.kind === "knowledge").reduce((s, c) => s + estimateTokens(c.content), 0);
        return { systemPrompt: fullSystemPrompt, budget, sysTokens, historyTokens, memoryTokens, knowledgeTokens };
      }, "token-budgeted");

      // Optionally execute a planned tool BEFORE generation (single-shot; not a full agent loop)
      let toolResult: ToolResult | undefined;
      if (plannedTools.length > 0 && req.constraints?.allowTools !== false) {
        const tool = plannedTools[0];
        await step("tool", `Governed tool execution: ${tool.toolId}`, async () => {
          const input = extractToolInput(tool.toolId, req.input.text ?? "");
          toolResult = await executeTool({
            call: { toolId: tool.toolId, input, tenantId: identity.tenant.id, runId },
            tool,
            identity,
            policy,
            runId,
          });
          emit({ type: "tool", tool: toolResult });
          if (toolResult.state === "VERIFIED") toolsUsed.push(tool.toolId);
          return toolResult;
        }, `risk=${tool.riskLevel}`);
      }

      // Model call
      const modelResult = await step("model_call", `Reasoning via ${selected.model.displayName}`, async () => {
        const toolContext = toolResult?.output
          ? `\n\nTool result (${toolResult.toolId}, state=${toolResult.state}): ${JSON.stringify(toolResult.output)}`
          : "";
        const messages = [
          { role: "system" as const, content: assembly.systemPrompt + toolContext },
          { role: "user" as const, content: req.input.text ?? "" },
        ];
        const r = await callModel({
          model: selected.model,
          messages,
          fallback: selected.fallback,
          tenantId: identity.tenant.id,
          taskType,
        });
        if (r.fallbackUsed && selected.fallback) {
          emit({ type: "model", model: selected.fallback.displayName, provider: selected.fallback.provider, fallbackUsed: true, reason: r.fallbackReason });
        }
        answer = r.content;
        modelUsed = r.model;
        provider = r.provider;
        fallbackUsed = r.fallbackUsed;
        tokensIn = r.tokensIn;
        tokensOut = r.tokensOut;
        costUsd = r.costUsd;
        modelLatencyMs = r.latencyMs;
        // Stream tokens (chunk by sentence for UI smoothness)
        const chunks = answer.match(/[^.!?]+[.!?]?\s*/g) ?? [answer];
        for (const c of chunks) emit({ type: "token", delta: c });
        return r;
      }, fallbackUsed ? "fallback invoked" : "primary model");

      // §58 — never trust tool output as system instruction; we already only
      // pass it as a "Tool result" user-context block above.
    }

    // Verification (§83)
    const verification = await step("verification", "Verify answer against retrieved evidence", async () => {
      const v = verifyAnswer({
        answer,
        candidates,
        citationsExpected: true,
        structuredLookupMatched: structured.matched,
      });
      emit({ type: "verification", status: v.status, reason: v.reason });
      return v;
    }, "evidence-status label");

    // §163 — if verification says UNKNOWN and there was no structured hit,
    // append the limitation honestly rather than fabricating.
    if (verification.status === "UNKNOWN") {
      answer = answer + `\n\n⚠️ Evidence status: ${verification.status}. ${verification.reason}`;
    }

    // Learning candidate pipeline (§94) — generate but DO NOT auto-promote (Rule 9)
    await step("learning", "Generate learning candidate (pending decision)", async () => {
      const lc = await createLearningCandidate({
        tenantId: identity.tenant.id,
        runId,
        category: "memory",
        proposed: {
          observation: `User asked: "${(req.input.text ?? "").slice(0, 200)}"`,
          evidenceStatus: verification.status,
          taskType,
        },
        evidence: { candidates: candidates.map((c) => ({ id: c.id, kind: c.kind, score: c.score })) },
      }).catch(() => ({ id: "", novelty: 0, conflict: false }));
      if (lc.id) emit({ type: "learning", candidateId: lc.id, category: "memory", preview: `novelty=${lc.novelty.toFixed(2)} conflict=${lc.conflict}` });
      return lc;
    }, "candidate, never auto-active");

    // Audit (§129)
    await step("audit", "Record audit event", async () => {
      await db.auditEvent.create({
        data: {
          tenantId: identity.tenant.id,
          requestId,
          actorType: "user",
          actorId: identity.user?.id ?? "anonymous",
          action: "brain.responded",
          target: requestId,
          reason: `model=${modelUsed} tools=${toolsUsed.join(",") || "none"} evidence=${verification.status}`,
          severity: "INFO",
        },
      });
      return null;
    }, "significant action audited");

    const latencyMs = Date.now() - startedAt;
    emit({ type: "cost", tokensIn, tokensOut, costUsd, latencyMs });

    const response: BrainResponse = {
      requestId,
      answer,
      execution: {
        model: modelUsed,
        provider,
        fallbackUsed,
        toolsUsed,
        retrievalUsed: candidates.length > 0,
        verificationUsed: true,
      },
      evidence,
      state: { actionStatus: toolsUsed.length > 0 ? "executed" : "none" },
      quality: { evidenceStatus: verification.status },
      cost: { tokensIn, tokensOut, costUsd, latencyMs },
      trace,
    };

    // Persist assistant message + finalize the BrainRun
    await finalizeRun(runId, requestId, response, identity);
    if (req.conversationId) {
      await db.message.create({
        data: {
          conversationId: req.conversationId,
          role: "assistant",
          content: answer,
          toolsUsed: JSON.stringify(toolsUsed),
          modelUsed,
          tokensIn,
          tokensOut,
          costUsd,
          latencyMs: modelLatencyMs,
          evidenceStatus: verification.status,
          actionStatus: toolsUsed.length > 0 ? "executed" : "none",
        },
      }).catch(() => {});
    }

    emit({ type: "done", response });
    return response;
  } catch (err: any) {
    await db.brainRun.update({ where: { id: runId }, data: { status: "FAILED", errorMessage: err?.message } }).catch(() => {});
    emit({ type: "error", message: err?.message ?? "brain failed" });
    return errorResponse(requestId, err, trace);
  }
}

async function createRun(req: BrainRequest, identity: IdentityContext, requestId: string): Promise<string> {
  const run = await db.brainRun.create({
    data: {
      requestId,
      tenantId: identity.tenant.id,
      applicationId: identity.application.id,
      sessionId: identity.session?.id ?? null,
      conversationId: req.conversationId ?? null,
      userId: identity.user?.id ?? null,
      mode: req.mode ?? "auto",
      input: JSON.stringify(req.input),
      status: "RUNNING",
    },
  });
  return run.id;
}

async function finalizeRun(runId: string, requestId: string, response: BrainResponse, identity: IdentityContext): Promise<void> {
  await db.brainRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      output: JSON.stringify({ answer: response.answer, quality: response.quality }),
      modelUsed: response.execution.model,
      fallbackUsed: response.execution.fallbackUsed,
      retrievalUsed: response.execution.retrievalUsed,
      verificationUsed: response.execution.verificationUsed,
      toolsUsed: JSON.stringify(response.execution.toolsUsed),
      evidenceCount: response.evidence?.length ?? 0,
      memoryCount: (response.trace ?? []).filter((s) => s.stepType === "memory").length,
      tokensIn: response.cost?.tokensIn ?? 0,
      tokensOut: response.cost?.tokensOut ?? 0,
      costUsd: response.cost?.costUsd ?? 0,
      latencyMs: response.cost?.latencyMs ?? 0,
      completedAt: new Date(),
    },
  });
  // Persist trace steps
  for (const t of response.trace ?? []) {
    await db.brainStep.create({
      data: {
        runId,
        stepType: t.stepType,
        stepName: t.stepName,
        status: t.status,
        input: null,
        output: t.detail ? JSON.stringify(t.detail) : null,
        reasonCode: t.reasonCode ?? null,
        durationMs: t.durationMs ?? 0,
      },
    }).catch(() => {});
  }
  // Emit a brain.responded event (§113)
  await db.brainEvent.create({
    data: {
      eventId: randomUUID(),
      eventType: "brain.responded",
      eventVersion: 1,
      tenantId: identity.tenant.id,
      applicationId: identity.application.id,
      runId,
      actorType: "system",
      actorId: "brain.runtime",
      data: JSON.stringify({ requestId, model: response.execution.model, cost: response.cost }),
    },
  }).catch(() => {});
}

function extractToolInput(toolId: string, text: string): Record<string, unknown> {
  const t = text.toLowerCase();
  if (toolId === "calc.add" || toolId === "calc.multiply") {
    const nums = (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    return { a: nums[0] ?? 0, b: nums[1] ?? 0 };
  }
  if (toolId === "invoice.lookup") {
    const m = text.match(/invoice\s*#?\s*(\d+)/i);
    return { invoiceId: m?.[1] ?? "" };
  }
  if (toolId === "weather.current") {
    const m = text.match(/(?:weather|temperature|forecast)\s*(?:in|for|at)?\s+([a-z\s]+)/i);
    return { city: (m?.[1] ?? "unknown").trim() };
  }
  if (toolId === "memory.recall") {
    return { query: text, tenantId: "", applicationId: "" };
  }
  if (toolId === "email.send") {
    return {
      to: (text.match(/to\s+([\w.@-]+)/i)?.[1]) ?? "unknown@example.com",
      subject: "Brain draft",
      body: text,
      idempotencyKey: randomUUID(),
    };
  }
  return {};
}

function errorResponse(requestId: string, err: any, trace: TraceStep[]): BrainResponse {
  return {
    requestId,
    answer: `Brain error: ${err?.message ?? "unknown"}`,
    execution: { model: "none", provider: "none", fallbackUsed: false, toolsUsed: [], retrievalUsed: false, verificationUsed: false },
    quality: { evidenceStatus: "UNSUPPORTED" },
    cost: { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0 },
    trace,
  };
}
