// VERIFY — platform adapter stub (spec §27, §67).
//
// Governance boundary (per PLATFORM_CATALOG):
//   "Brain may assist verification but must NOT fabricate verification (§8).
//    Evidence-driven only."
//
// Phase 0 audit (docs/phase0-audit.md, platform #5):
//   - Repo: cirkle-superapp/verify — Next.js 16 + React 19 + Prisma + shadcn/ui +
//     Tailwind 4 + Zustand + recharts + tesseract.js + Neon + Drizzle (dual ORM).
//   - AI-powered live identity verification: 3-pass Arabic OCR (image quality →
//     Arabic-first OCR → field extraction), Egyptian 14-digit National ID decoder
//     (gender/birthdate), MRZ TD1 (ID) + TD3 (passport) parsing, live face capture
//     + VLM face match, liveness (3 random challenges), Evaluation Lab.
//   - Most Brain-aligned repo in the audit (Phase 0 ranking P1).
//   - Real authorized data the platform would expose (production adapter):
//       • Verification records — OCR-extracted fields, MRZ data, decoded ID
//       • Face match results (score, confidence)
//       • Liveness challenge outcomes (3 challenges + verdicts)
//       • Evaluation Lab golden cases (for Brain §86-92 reuse)
//   - §8: Brain MUST NOT fabricate verification — every claim must cite an
//     evidence row from Verify's actual output.

import { PLATFORM_CATALOG } from "@/lib/brain/platform-registry";
import type { BrainPlatformAdapter } from "./index";
import { registerAdapter } from "./registry";

const catalog = PLATFORM_CATALOG.find((p) => p.slug === "verify");
if (!catalog) throw new Error("PLATFORM_CATALOG missing 'verify' entry");

const adapter: BrainPlatformAdapter = {
  platformSlug: catalog.slug,
  platformName: catalog.name,

  getCapabilities() {
    return catalog.capabilities;
  },

  async publishEvents(events) {
    // STUB — production would POST to the Verify webhook.
    // §8: events carrying RESTRICTED identity data must be tenant-scoped
    // and never leak to GLOBAL.
    console.info(
      `[adapter:verify] publishEvents: received ${events.length} events (stub)`,
    );
    return { accepted: events.length, rejected: 0 };
  },

  async retrieveAuthorizedData(query) {
    // STUB — production would call Verify's authorized read API:
    //   GET /api/verify/records/{recordId}?tenantId=...
    //   GET /api/verify/face/match?recordId=...
    //   GET /api/verify/mrz/parse?recordId=...
    // and return items like:
    //   { kind: "verify.record", content: "{ recordId, documentType, fields }", provenance: "verify:ocr-pass-3" }
    //   { kind: "verify.face.match", content: "{ recordId, score, liveness }", provenance: "verify:vlm" }
    //   { kind: "verify.mrz", content: "{ docNumber, name, dob, expiry, gender }", provenance: "verify:td3-parser" }
    // Every item MUST carry provenance (§8 — no fabricated evidence, §165).
    console.info(
      `[adapter:verify] retrieveAuthorizedData: text="${query.text.slice(0, 80)}" scopes=${query.scopes.join(",")} (stub — returning empty)`,
    );
    return { items: [] };
  },

  async receiveBrainResponses(response) {
    // STUB — production would deliver the Brain's response into the Verify
    // Evaluation Lab or operator UI.
    console.info(
      `[adapter:verify] receiveBrainResponses: requestId=${response.requestId} (stub)`,
    );
  },

  async receiveKnowledgeUpdates(knowledge) {
    console.info(
      `[adapter:verify] receiveKnowledgeUpdates: ${knowledge.length} records (stub)`,
    );
  },

  async receiveModelCapabilities(models) {
    console.info(
      `[adapter:verify] receiveModelCapabilities: ${models.length} models (stub)`,
    );
  },
};

registerAdapter(adapter);

export default adapter;
