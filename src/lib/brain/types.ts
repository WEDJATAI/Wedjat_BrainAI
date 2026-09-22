// WEDJAT BRAIN V2 — Core Type Contracts
// Spec §14 (request), §15 (response), §113-114 (events)
// The LLM is one replaceable reasoning component. The Brain owns identity,
// memory, knowledge, evidence, retrieval, context, tools, policy, verification,
// learning, observability, cost, audit.

export type BrainMode = "auto" | "fast" | "balanced" | "deep";
export type PolicyMode = "LOW_COST" | "BALANCED" | "HIGH_QUALITY" | "CRITICAL";
export type DataClassification = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MemoryDomain = "EPISODIC" | "SEMANTIC" | "PROCEDURAL";
export type MemoryStatus =
  | "RAW" | "CANDIDATE" | "VALIDATING" | "VALIDATED"
  | "ACTIVE" | "SUPERSEDED" | "EXPIRED" | "REJECTED" | "DELETED";
export type KnowledgeType =
  | "FACT" | "RULE" | "POLICY" | "PROCEDURE" | "OBSERVATION"
  | "OPINION" | "INFERENCE" | "PREFERENCE" | "EVENT";
export type KnowledgeStatus =
  | "CANDIDATE" | "VALIDATING" | "VALIDATED" | "ACTIVE"
  | "SUPERSEDED" | "EXPIRED" | "REJECTED";
export type EvidenceStatus =
  | "VERIFIED" | "SUPPORTED" | "INFERRED" | "UNCERTAIN"
  | "CONFLICTED" | "UNSUPPORTED" | "UNKNOWN";
export type ActionState =
  | "PROPOSED" | "VALIDATED" | "AUTHORIZED" | "EXECUTING"
  | "EXECUTED" | "VERIFIED" | "REJECTED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
export type TaskType =
  | "simple" | "factual" | "reasoning" | "synthesis"
  | "coding" | "tool_use" | "high_risk" | "unknown";
export type ModelTier = "FAST" | "BALANCED" | "REASONING" | "SPECIALIST";
export type BrainHealthState =
  | "HEALTHY" | "DEGRADED" | "PARTIALLY_AVAILABLE" | "READ_ONLY" | "SAFE_MODE" | "OFFLINE";

export interface AttachmentRef {
  id: string;
  type: string;
  uri?: string;
  name?: string;
}

// §14 BrainRequest
export interface BrainRequest {
  requestId: string;
  tenantId: string;
  applicationId: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  input: {
    text?: string;
    attachments?: AttachmentRef[];
  };
  mode?: BrainMode;
  permissions: {
    scopes: string[];
  };
  constraints?: {
    maxLatencyMs?: number;
    maxCost?: number;
    allowExternalSearch?: boolean;
    allowTools?: boolean;
  };
  metadata?: Record<string, unknown>;
}

// §15 BrainResponse
export interface EvidenceRef {
  id: string;
  type: KnowledgeType;
  claim: string;
  sourceTitle?: string;
  sourceUri?: string;
  evidenceStatus: EvidenceStatus;
  retrievedAt?: string;
  validFrom?: string;
  validUntil?: string;
  conflict?: boolean;
}

export interface BrainResponse {
  requestId: string;
  answer: string;
  execution: {
    model: string;
    provider: string;
    fallbackUsed: boolean;
    toolsUsed: string[];
    retrievalUsed: boolean;
    verificationUsed: boolean;
  };
  evidence?: EvidenceRef[];
  state?: {
    actionStatus?: "none" | "proposed" | "authorized" | "executed" | "verified";
  };
  quality?: {
    evidenceStatus: EvidenceStatus;
  };
  cost?: {
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    latencyMs: number;
  };
  trace?: TraceStep[];
}

// §85 — structured audit info (no private hidden reasoning)
export interface TraceStep {
  stepType:
    | "identity" | "policy" | "task_router" | "memory" | "knowledge"
    | "retrieval" | "context" | "model_router" | "model_call"
    | "tool" | "verification" | "response" | "learning" | "audit";
  stepName: string;
  status: "STARTED" | "COMPLETED" | "FAILED" | "SKIPPED";
  reasonCode?: string;
  summary?: string;
  detail?: Record<string, unknown>;
  durationMs?: number;
}

// §113-114 BrainEvent
export interface BrainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  timestamp: string;
  runId?: string;
  tenantId: string;
  applicationId: string;
  actor?: { type: "user" | "agent" | "service" | "system"; id: string };
  data: T;
}

// §16 Identity context (resolved)
export interface IdentityContext {
  tenant: { id: string; name: string; slug: string; dataPolicy: DataClassification };
  application: {
    id: string; name: string; slug: string;
    knowledgeScope: string; memoryScope: string; toolScope: string;
    policyScope: string; modelPolicy: PolicyMode;
  };
  user?: { id: string; email: string; name?: string; scopes: string[] };
  session?: { id: string; externalRef?: string };
}

// §20-21 Memory
export interface MemoryRecord {
  id: string;
  tenantId: string;
  applicationId: string;
  userId?: string;
  conversationId?: string;
  domain: MemoryDomain;
  type: string;
  scope: "GLOBAL" | "APPLICATION" | "TENANT" | "ORGANIZATION" | "USER" | "SESSION";
  content: string;
  source?: string;
  confidence: number;
  status: MemoryStatus;
  version: number;
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// §26-29 Knowledge
export interface KnowledgeRecord {
  id: string;
  tenantId: string;
  applicationId: string;
  sourceId?: string;
  type: KnowledgeType;
  scope: "GLOBAL" | "APPLICATION" | "TENANT";
  claim: string;
  content: string;
  status: KnowledgeStatus;
  version: number;
  validFrom?: Date;
  validUntil?: Date;
  refreshSchedule?: string;
  lastRefreshedAt?: Date;
  confidence: number;
  source?: {
    id: string; sourceType: string; title: string; sourceUri?: string;
    author?: string; publisher?: string; publishedAt?: Date;
    trustLevel: string; verificationStatus: string; dataClassification: DataClassification;
  };
  evidence?: Array<{
    id: string; evidenceType: string; content: string; section?: string;
  }>;
}

// §34 Retrieval
export interface RetrievalCandidate {
  kind: "memory" | "knowledge" | "document" | "structured";
  id: string;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
  structuredScore?: number;
  content: string;
  source?: string;
  type?: string;
  scope?: string;
  validFrom?: Date;
  validUntil?: Date;
  evidenceStatus?: EvidenceStatus;
  record?: MemoryRecord | KnowledgeRecord;
}

// §45 Model abstraction
export interface ModelDescriptor {
  id: string;
  modelId: string;
  provider: string;
  displayName: string;
  tier: ModelTier;
  contextLimit: number;
  costInPer1k: number;
  costOutPer1k: number;
  capabilities: string[];
  privacyPolicy: DataClassification;
  latencyP50Ms: number;
  reliability: number;
  status: "ACTIVE" | "DEGRADED" | "OFFLINE";
  fallbackModelId?: string;
}

export interface ModelCallResult {
  model: string;
  provider: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  success: boolean;
  error?: string;
}

// §51 Tool
export interface ToolDescriptor {
  id: string;
  toolId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  requiredScopes: string[];
  riskLevel: RiskLevel;
  timeout: number;
  idempotencyPolicy: "NONE" | "IDEMPOTENT" | "IDEMPOTENCY_KEY";
  auditRequirement: boolean;
  approvalRequirement: boolean;
  costProfile: number;
  status: "ACTIVE" | "DISABLED";
}

export interface ToolCall {
  toolId: string;
  input: Record<string, unknown>;
  runId?: string;
  tenantId: string;
}

export interface ToolResult {
  toolId: string;
  executionId: string;
  state: ActionState;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
  requiresApproval: boolean;
  approved: boolean;
}

// §41-43 Context
export interface ContextAssembly {
  systemPrompt: string;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
  tokenBudget: number;
  tokensUsed: number;
  memoryUsed: number;
  knowledgeUsed: number;
  historyUsed: number;
  toolsAvailable: ToolDescriptor[];
  truncated: boolean;
}

// §73 Observability
export interface BrainRunSummary {
  id: string;
  requestId: string;
  tenantId: string;
  applicationId: string;
  status: string;
  mode: BrainMode;
  taskType: TaskType;
  modelUsed?: string;
  fallbackUsed: boolean;
  retrievalUsed: boolean;
  verificationUsed: boolean;
  toolsUsed: string[];
  evidenceCount: number;
  memoryCount: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  createdAt: Date;
  completedAt?: Date;
  steps: TraceStep[];
}

// Streaming protocol over the /api/brain/respond SSE-like channel.
export type BrainStreamEvent =
  | { type: "trace"; step: TraceStep }
  | { type: "token"; delta: string }
  | { type: "evidence"; evidence: EvidenceRef[] }
  | { type: "memory"; memory: Array<{ id: string; content: string; type: string; scope: string }> }
  | { type: "model"; model: string; provider: string; fallbackUsed: boolean; reason?: string }
  | { type: "tool"; tool: ToolResult }
  | { type: "verification"; status: EvidenceStatus; reason?: string }
  | { type: "cost"; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number }
  | { type: "learning"; candidateId: string; category: string; preview: string }
  | { type: "done"; response: BrainResponse }
  | { type: "error"; message: string; code?: string };
