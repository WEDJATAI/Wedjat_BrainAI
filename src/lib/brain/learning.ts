// WEDJAT BRAIN V2 — Learning candidate pipeline (§22, §94-96).
//
// Production activity may generate learning candidates but must NOT silently
// modify trusted knowledge, prompts, policies, or model behavior (Rule 9).
// Pipeline (§94): production event → observation → candidate insight →
// classification → provenance → novelty → duplication → contradiction →
// quality → promotion decision → index/memory/knowledge. Categories (§95):
// memory, knowledge, procedural, routing, prompt, tool, evaluation.

import { db } from "@/lib/db";
import { buildTermVector, serializeVector, cosineSimilarity, deserializeVector } from "./vectors";

export interface LearningCandidateInput {
  tenantId: string;
  runId?: string;
  category: "memory" | "knowledge" | "procedural" | "routing" | "prompt" | "tool" | "evaluation";
  proposed: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

/** Generate a learning candidate. Never auto-promotes (Rule 9). */
export async function createLearningCandidate(input: LearningCandidateInput): Promise<{ id: string; novelty: number; conflict: boolean }> {
  // §22 novelty check — compare proposed content against existing candidates / memories / knowledge
  const proposedText = JSON.stringify(input.proposed);
  const proposedVec = buildTermVector(proposedText);

  const existing = await db.learningCandidate.findMany({
    where: { tenantId: input.tenantId, category: input.category },
    take: 100,
  });
  let maxSim = 0;
  for (const e of existing) {
    const eText = e.proposed ?? "";
    const eVec = buildTermVector(eText);
    const sim = cosineSimilarity(proposedVec, eVec);
    if (sim > maxSim) maxSim = sim;
  }
  const novelty = Math.max(0, 1 - maxSim);
  const conflict = novelty < 0.2 && maxSim > 0.6;

  const created = await db.learningCandidate.create({
    data: {
      tenantId: input.tenantId,
      category: input.category,
      proposed: JSON.stringify(input.proposed),
      evidence: input.evidence ? JSON.stringify(input.evidence) : null,
      noveltyScore: novelty,
      conflictDetected: conflict,
      decision: "PENDING",
    },
  });
  return { id: created.id, novelty, conflict };
}

/** Decide on a candidate: PROMOTED | REJECTED | DEFERRED (§94). */
export async function decideCandidate(id: string, decision: "PROMOTED" | "REJECTED" | "DEFERRED", reason: string): Promise<void> {
  await db.learningCandidate.update({
    where: { id },
    data: { decision, decisionReason: reason, decidedAt: new Date() },
  });
  await db.auditEvent.create({
    data: {
      tenantId: (await db.learningCandidate.findUnique({ where: { id } }))?.tenantId ?? "",
      actorType: "system",
      actorId: "brain.learning",
      action: `learning.${decision.toLowerCase()}`,
      target: id,
      reason,
      severity: "INFO",
    },
  });
}

/** List recent candidates (for the admin panel). */
export async function listCandidates(tenantId: string, limit = 20) {
  return db.learningCandidate.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
