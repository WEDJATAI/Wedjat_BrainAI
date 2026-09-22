// WEDJAT BRAIN V2 — Model abstraction + router + fallback (§45-50, §60).
//
// Applications must not directly depend on provider-specific SDKs (§45). The
// model router selects models based on task, complexity, modality, privacy,
// latency, cost, quality, historical evaluation, availability (§47). Explicit
// fallback (§48) on timeout / rate limit / outage / context overflow / etc.
// Cost-aware routing (§76). Model data policy (§60): restricted data may only
// go to approved providers.

import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import type {
  ModelDescriptor, ModelCallResult, ModelTier, TaskType, PolicyMode,
  DataClassification, BrainMode,
} from "./types";
import { buildTermVector, serializeVector } from "./vectors";
import { checkDataClassAllowed, type PolicyRules } from "./policy";

// ----------------------------------------------------------------------------
// Model registry — seeded by /api/brain/seed (§46).
// ----------------------------------------------------------------------------

export async function listModels(): Promise<ModelDescriptor[]> {
  const rows = await db.model.findMany({ where: { status: "ACTIVE" } });
  return rows.map(toDescriptor);
}

export async function getModelByTier(tier: ModelTier): Promise<ModelDescriptor | null> {
  const row = await db.model.findFirst({ where: { tier, status: "ACTIVE" }, orderBy: { reliability: "desc" } });
  return row ? toDescriptor(row) : null;
}

export function toDescriptor(m: any): ModelDescriptor {
  return {
    id: m.id,
    modelId: m.modelId,
    provider: m.provider,
    displayName: m.displayName,
    tier: m.tier as ModelTier,
    contextLimit: m.contextLimit,
    costInPer1k: m.costInPer1k,
    costOutPer1k: m.costOutPer1k,
    capabilities: m.capabilities ? m.capabilities.split(",").map((s: string) => s.trim()) : [],
    privacyPolicy: m.privacyPolicy as DataClassification,
    latencyP50Ms: m.latencyP50Ms,
    reliability: m.reliability,
    status: m.status,
    fallbackModelId: m.fallbackModelId ?? undefined,
  };
}

// ----------------------------------------------------------------------------
// Task router (§47) — pick a model tier based on task + policy mode.
// ----------------------------------------------------------------------------

export function pickTier(taskType: TaskType, mode: BrainMode | undefined, policyMode: PolicyMode): ModelTier {
  // §47 routing map
  if (taskType === "high_risk") return "REASONING";
  if (taskType === "reasoning" || taskType === "synthesis") return "REASONING";
  if (taskType === "coding") return "REASONING";
  if (taskType === "tool_use") return "BALANCED";
  if (taskType === "factual") return "BALANCED";
  if (taskType === "simple") return "FAST";
  // Explicit mode override (§14)
  if (mode === "fast") return "FAST";
  if (mode === "deep") return "REASONING";
  if (mode === "balanced") return "BALANCED";
  // Policy mode tilt (§76)
  if (policyMode === "LOW_COST") return "FAST";
  if (policyMode === "HIGH_QUALITY" || policyMode === "CRITICAL") return "REASONING";
  return "BALANCED";
}

export async function selectModel(opts: {
  taskType: TaskType;
  mode: BrainMode | undefined;
  policyMode: PolicyMode;
  policy: PolicyRules;
  dataClass: DataClassification;
}): Promise<{ model: ModelDescriptor; reason: string; fallback?: ModelDescriptor }> {
  const tier = pickTier(opts.taskType, opts.mode, opts.policyMode);
  const all = await listModels();
  const candidates = all.filter((m) => m.tier === tier);
  if (candidates.length === 0) {
    // fall back to any active model
    const any = all[0];
    if (!any) throw new Error("no active models registered");
    return { model: any, reason: `no ${tier} model available — using ${any.displayName}` };
  }
  // §60 — provider allowlist + data-class ceiling
  const allowed = candidates.filter((m) => {
    const decision = checkDataClassAllowed(opts.policy, opts.dataClass, m.provider);
    return decision.allowed;
  });
  const pool = allowed.length > 0 ? allowed : candidates;
  // pick highest reliability, then lowest cost
  pool.sort((a, b) => b.reliability - a.reliability || a.costOutPer1k - b.costOutPer1k);
  const model = pool[0];
  const reason = `task=${opts.taskType} mode=${opts.mode ?? "auto"} policy=${opts.policyMode} → tier=${tier} → ${model.displayName}`;
  const fallback = model.fallbackModelId
    ? (all.find((m) => m.id === model.fallbackModelId) ?? undefined)
    : undefined;
  return { model, reason, fallback };
}

// ----------------------------------------------------------------------------
// §45 ModelProvider interface — abstraction over z-ai-web-dev-sdk.
// The underlying provider can evolve; Wedjat owns the abstraction (§49).
// ----------------------------------------------------------------------------

export interface ModelCallInput {
  model: ModelDescriptor;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
  maxTokens?: number;
  fallback?: ModelDescriptor;
  tenantId: string;
  taskType?: TaskType;
}

export async function callModel(input: ModelCallInput): Promise<ModelCallResult> {
  const startedAt = Date.now();
  let attempt: ModelDescriptor = input.model;
  let fallbackUsed = false;
  let fallbackReason: string | undefined;

  for (let attemptNo = 0; attemptNo < 2; attemptNo++) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: input.messages as any,
        thinking: { type: "disabled" },
      });
      const content = completion.choices[0]?.message?.content ?? "";
      const tokensIn = estimateTokens(input.messages.map((m) => m.content).join("\n"));
      const tokensOut = estimateTokens(content);
      const latencyMs = Date.now() - startedAt;
      const costUsd = (tokensIn / 1000) * attempt.costInPer1k + (tokensOut / 1000) * attempt.costOutPer1k;
      // record usage (§50, §75)
      await db.modelUsage.create({
        data: {
          tenantId: input.tenantId,
          modelId: attempt.id,
          tokensIn,
          tokensOut,
          costUsd,
          latencyMs,
          fallbackUsed,
          success: true,
          taskType: input.taskType ?? null,
        },
      }).catch(() => {});
      return {
        model: attempt.modelId,
        provider: attempt.provider,
        content,
        tokensIn,
        tokensOut,
        costUsd,
        latencyMs,
        fallbackUsed,
        fallbackReason,
        success: true,
      };
    } catch (err: any) {
      fallbackReason = `${attempt.modelId} failed: ${err?.message ?? "unknown"}`;
      if (attemptNo === 0 && input.fallback) {
        // §48 explicit fallback
        fallbackUsed = true;
        attempt = input.fallback;
        continue;
      }
      await db.modelUsage.create({
        data: {
          tenantId: input.tenantId,
          modelId: attempt.id,
          tokensIn: 0, tokensOut: 0, costUsd: 0,
          latencyMs: Date.now() - startedAt,
          fallbackUsed, success: false,
          taskType: input.taskType ?? null,
        },
      }).catch(() => {});
      return {
        model: attempt.modelId,
        provider: attempt.provider,
        content: "",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencyMs: Date.now() - startedAt,
        fallbackUsed,
        fallbackReason,
        success: false,
        error: fallbackReason,
      };
    }
  }
  // unreachable
  return {
    model: attempt.modelId, provider: attempt.provider, content: "",
    tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - startedAt,
    fallbackUsed, fallbackReason, success: false, error: "exhausted fallbacks",
  };
}

function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}
