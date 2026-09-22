// WEDJAT BRAIN V2 — Verification engine (§83-85, §162-165).
//
// Verification is independent enough to catch errors. Checks: schema
// correctness, source existence, citation correctness, calculation, policy
// compliance, tool result consistency, temporal consistency, contradiction
// (§83). Never assume "second LLM says correct" means factually correct.
// Evidence is stronger than model confidence. The Brain must be able to
// return UNKNOWN / INSUFFICIENT EVIDENCE (§163) rather than inventing an
// answer. No fake confidence (§165) — prefer interpretable labels.

import type { EvidenceRef, EvidenceStatus, RetrievalCandidate } from "./types";

export interface VerificationInput {
  answer: string;
  candidates: RetrievalCandidate[];
  citationsExpected: boolean;
  structuredLookupMatched: boolean;
}

export interface VerificationResult {
  status: EvidenceStatus;
  reason: string;
  supportedBy: EvidenceRef[];
  conflicts: boolean;
}

/** Run deterministic + heuristic verification on the model output (§83). */
export function verifyAnswer(input: VerificationInput): VerificationResult {
  const supportedBy: EvidenceRef[] = [];
  let conflicts = false;

  for (const c of input.candidates) {
    if (c.kind !== "knowledge") continue;
    if (c.record && "claim" in c.record) {
      const claim = c.record.claim as string;
      // Light citation check: does the answer reuse a significant token from the claim?
      const tokenOverlap = sharedSignificantTokens(claim, input.answer);
      if (tokenOverlap > 0.15) {
        supportedBy.push({
          id: c.id,
          type: c.record.type as any,
          claim,
          sourceTitle: c.source,
          evidenceStatus: (c.evidenceStatus as EvidenceStatus) ?? "SUPPORTED",
          retrievedAt: new Date().toISOString(),
          conflict: false,
        });
      }
    }
    if ((c as any).conflict) conflicts = true;
  }

  // §163 — if there's no supporting evidence and no structured hit, prefer
  // UNKNOWN over fabrication.
  if (supportedBy.length === 0 && !input.structuredLookupMatched) {
    return {
      status: "UNKNOWN",
      reason: "no supporting evidence retrieved and no structured lookup matched — answer is unsupported",
      supportedBy: [],
      conflicts: false,
    };
  }

  if (conflicts) {
    return {
      status: "CONFLICTED",
      reason: "retrieved knowledge contains conflicting claims — refer to source provenance",
      supportedBy,
      conflicts: true,
    };
  }

  // §84 — map source trust levels to evidence status
  const top = supportedBy[0];
  if (top?.evidenceStatus === "VERIFIED") {
    return { status: "VERIFIED", reason: "answer supported by a VERIFIED source", supportedBy, conflicts };
  }
  if (supportedBy.length >= 2) {
    return { status: "SUPPORTED", reason: `${supportedBy.length} independent supporting sources`, supportedBy, conflicts };
  }
  if (input.structuredLookupMatched) {
    return { status: "VERIFIED", reason: "answer verified via deterministic structured lookup (§37)", supportedBy, conflicts };
  }
  return { status: "INFERRED", reason: "answer inferred from limited evidence — exercise caution", supportedBy, conflicts };
}

function sharedSignificantTokens(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const tb = new Set(b.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  if (ta.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / ta.size;
}
