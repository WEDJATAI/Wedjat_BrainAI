// WEDJAT BRAIN — Cross-Platform Registry (spec §27, §30, §160, §161)
//
// Static catalog of the 14 platforms from the cross-platform spec (§4-18),
// each with its domain, capabilities, scopes, tools, risk ceiling, and
// governance boundaries. The Platform row in the DB is the runtime record;
// this catalog is the compile-time source of truth used to seed the DB.
//
// Per spec §2: every platform remains its own source of truth. The Brain
// owns cognition only. Per §45 (SGTX), §46 (Justice), §47 (Finance): special
// governance — AI advice ≠ authorization, AI recommendation ≠ execution.

export type PlatformDomain =
  | "social" | "mail" | "media" | "verification" | "agreements"
  | "business" | "trade" | "finance" | "justice" | "compliance";

export type RiskCeiling = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DataClassCeiling = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
export type KnowledgeScope = "PRIVATE" | "APPLICATION" | "TENANT" | "ORGANIZATION" | "GLOBAL_VERIFIED";
export type ModelPolicy = "LOW_COST" | "BALANCED" | "HIGH_QUALITY" | "CRITICAL";
export type AdapterStatus =
  | "PENDING" | "REGISTERED" | "AUTHENTICATED" | "ACTIVE"
  | "DEGRADED" | "DISABLED" | "UNAUTHORIZED" | "CONFIG_ERROR" | "AUDITED";

export interface PlatformCatalogEntry {
  slug: string;
  name: string;
  displayName: string;
  domain: PlatformDomain;
  description: string;
  repoUrl?: string;
  productionUrl?: string;
  knowledgeScope: KnowledgeScope;
  memoryScope: KnowledgeScope;
  toolScope: KnowledgeScope;
  dataClassCeiling: DataClassCeiling;
  modelPolicy: ModelPolicy;
  allowedBrainScopes: string[];
  riskCeiling: RiskCeiling;
  capabilities: string[];
  eventTypes: string[];
  domainTools: string[];
  governanceBoundary?: string;
  personality?: { tone: string; vocabulary: string[]; systemPromptSuffix: string };
}

// 14 platforms from spec §4-18. Audit findings (Phase 0, docs/phase0-audit.md)
// inform which are inspectable vs stub vs 404 — but the registry lists all 14
// per the spec regardless, because the Brain contract must be ready for all.
export const PLATFORM_CATALOG: PlatformCatalogEntry[] = [
  {
    slug: "cirkle",
    name: "CIRKLE",
    displayName: "Cirkle Superapp",
    domain: "social",
    description: "Superapp hub — users, social graph, content, recommendations, mini-apps. (spec §4.1)",
    repoUrl: "https://github.com/cirkle-superapp/CIRKLE",
    productionUrl: "https://cirkle-superapp.vercel.app/",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "CONFIDENTIAL",
    modelPolicy: "BALANCED",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:memory.write", "brain:publishEvent"],
    riskCeiling: "MEDIUM",
    capabilities: ["answer", "recommend", "classify", "retrieve", "summarize", "extract"],
    eventTypes: ["brain.application.request", "brain.application.response", "brain.user.feedback", "brain.memory.candidate", "learning.observation"],
    domainTools: ["cirkle.feed.recommend", "cirkle.miniapp.discover", "cirkle.social.graph"],
    governanceBoundary: "Private user activity must NOT become global Brain knowledge (§4.1).",
    personality: { tone: "friendly", vocabulary: ["superapp", "mini-app", "circle"], systemPromptSuffix: "Cirkle context: superapp social+content hub." },
  },
  {
    slug: "mail",
    name: "CIRKLE_MAIL",
    displayName: "Cirkle Mail",
    domain: "mail",
    description: "Email intelligence — classification, summarization, search, draft assistance, commitment detection. (spec §5)",
    repoUrl: "https://github.com/cirkle-superapp/MAIL",
    productionUrl: "https://cirkle-mail.vercel.app/",
    knowledgeScope: "PRIVATE",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "CONFIDENTIAL",
    modelPolicy: "BALANCED",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:memory.write", "brain:publishEvent", "brain:tools.execute"],
    riskCeiling: "LOW",
    capabilities: ["classify", "summarize", "extract", "search", "draft", "translate"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "brain.memory.candidate", "learning.observation", "learning.correction", "learning.preference"],
    domainTools: ["mail.classify", "mail.summarize", "mail.thread.followup", "mail.commitment.detect"],
    governanceBoundary: "Private email contents must NOT become global Brain knowledge (§5, §48, §75).",
    personality: { tone: "professional", vocabulary: ["email", "thread", "inbox"], systemPromptSuffix: "Mail context: email intelligence. Privacy is paramount." },
  },
  {
    slug: "olympex",
    name: "OLYMPEX",
    displayName: "OlympEx",
    domain: "business",
    description: "Egyptian fresh/frozen produce exporter corporate site + RFQ pipeline. (spec §6, Phase 0 audit)",
    repoUrl: "https://github.com/fortleem/olympex_export",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "INTERNAL",
    modelPolicy: "BALANCED",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:publishEvent"],
    riskCeiling: "LOW",
    capabilities: ["answer", "classify", "extract", "translate"],
    eventTypes: ["brain.application.request", "brain.user.feedback"],
    domainTools: ["olympex.rfq.lookup", "olympex.product.search"],
    governanceBoundary: "Export/RFQ data is application-scoped (§6).",
    personality: { tone: "business", vocabulary: ["export", "produce", "RFQ"], systemPromptSuffix: "OlympEx context: Egyptian agricultural export." },
  },
  {
    slug: "mashahd",
    name: "MASHAHD",
    displayName: "Mashahd",
    domain: "media",
    description: "Media discovery, recommendation intelligence, content understanding, transcription-derived knowledge. (spec §7)",
    repoUrl: "https://github.com/cirkle-superapp/mashahd",
    productionUrl: "https://mashahd.vercel.app/",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "INTERNAL",
    modelPolicy: "BALANCED",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:memory.write", "brain:publishEvent", "brain:tools.execute"],
    riskCeiling: "MEDIUM",
    capabilities: ["answer", "recommend", "classify", "summarize", "search", "translate", "extract"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "brain.memory.candidate", "learning.observation", "learning.preference", "learning.success", "learning.failure"],
    domainTools: ["mashahd.media.recommend", "mashahd.transcript.search", "mashahd.content.classify"],
    governanceBoundary: "User engagement signals must NOT auto-become global knowledge (§7).",
    personality: { tone: "engaging", vocabulary: ["video", "creator", "stream"], systemPromptSuffix: "Mashahd context: media discovery + recommendation." },
  },
  {
    slug: "verify",
    name: "VERIFY",
    displayName: "Cirkle Verify",
    domain: "verification",
    description: "Identity verification — document/entity/evidence comparison, anomaly detection, provenance, confidence states. (spec §8)",
    repoUrl: "https://github.com/cirkle-superapp/verify",
    productionUrl: "https://cirkle-verify.vercel.app/",
    knowledgeScope: "TENANT",
    memoryScope: "TENANT",
    toolScope: "APPLICATION",
    dataClassCeiling: "RESTRICTED",
    modelPolicy: "HIGH_QUALITY",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:tools.execute", "brain:publishEvent"],
    riskCeiling: "HIGH",
    capabilities: ["verify", "compare", "classify", "extract", "retrieve"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "brain.tool.outcome", "learning.observation", "learning.evaluation_case"],
    domainTools: ["verify.document.ocr", "verify.face.match", "verify.entity.lookup", "verify.mrz.decode"],
    governanceBoundary: "Brain may assist verification but must NOT fabricate verification (§8). Evidence-driven only.",
    personality: { tone: "precise", vocabulary: ["verification", "document", "identity"], systemPromptSuffix: "Verify context: evidence-driven identity verification. Never fabricate." },
  },
  {
    slug: "wasl",
    name: "WASL",
    displayName: "Wasl",
    domain: "agreements",
    description: "Agreement understanding, commitment extraction, obligation/deadline detection, commitment history. (spec §9)",
    repoUrl: "https://github.com/cirkle-superapp/wasl",
    productionUrl: "https://cirkle-wasl.vercel.app/",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "CONFIDENTIAL",
    modelPolicy: "HIGH_QUALITY",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:tools.execute", "brain:publishEvent"],
    riskCeiling: "MEDIUM",
    capabilities: ["extract", "classify", "summarize", "compare", "plan"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "brain.memory.candidate", "learning.observation"],
    domainTools: ["wasl.commitment.extract", "wasl.obligation.lookup", "wasl.deadline.detect"],
    governanceBoundary: "Wasl's commitment/authorization semantics remain authoritative in Wasl (§9).",
    personality: { tone: "formal", vocabulary: ["agreement", "commitment", "obligation"], systemPromptSuffix: "Wasl context: agreement + commitment intelligence." },
  },
  {
    slug: "aurienta",
    name: "AURIENTA",
    displayName: "Aurienta",
    domain: "business",
    description: "Business formation, company structures, partners, opportunities, partner matching. (spec §10)",
    repoUrl: "https://github.com/Aurienta/Aurienta",
    productionUrl: "https://aurienta.vercel.app/",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "CONFIDENTIAL",
    modelPolicy: "BALANCED",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:tools.execute", "brain:publishEvent"],
    riskCeiling: "MEDIUM",
    capabilities: ["answer", "recommend", "classify", "extract", "research"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "brain.memory.candidate", "learning.observation"],
    domainTools: ["aurienta.company.lookup", "aurienta.partner.match", "aurienta.opportunity.search"],
    governanceBoundary: "Brain must not make consequential business decisions without application authorization (§10).",
    personality: { tone: "consultative", vocabulary: ["company", "partner", "opportunity"], systemPromptSuffix: "Aurienta context: business formation + matching." },
  },
  {
    slug: "sgtx",
    name: "SGTX",
    displayName: "SGTX",
    domain: "trade",
    description: "Sovereign Governed Trade Execution — non-custodial, AI-governed trade execution. (spec §11, §45)",
    repoUrl: "https://github.com/SGTX-PILOT/SGTX",
    productionUrl: "https://sgtx.vercel.app/",
    knowledgeScope: "TENANT",
    memoryScope: "ORGANIZATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "RESTRICTED",
    modelPolicy: "CRITICAL",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:tools.execute", "brain:publishEvent"],
    riskCeiling: "CRITICAL",
    capabilities: ["research", "classify", "summarize", "verify", "recommend", "compare"],
    eventTypes: ["brain.application.request", "brain.tool.outcome", "brain.user.feedback", "learning.observation", "learning.evaluation_case"],
    domainTools: ["sgtx.trade.lookup", "sgtx.compliance.check", "sgtx.risk.signal", "sgtx.document.classify"],
    governanceBoundary: "DO NOT bypass SGTX Governor / OPA / WasmEdge / Human Authorization / Crypto Signature / Loom / NATS (§11, §45). AI advice ≠ authorization; AI recommendation ≠ execution.",
    personality: { tone: "governed", vocabulary: ["trade", "governance", "sovereign"], systemPromptSuffix: "SGTX context: trade intelligence under strict governance. Never bypass Governor/OPA/WasmEdge pipeline." },
  },
  {
    slug: "mtq",
    name: "MTQ",
    displayName: "Mithqal",
    domain: "finance",
    description: "Neutral settlement capability — market intelligence, structured financial data, research, risk signals. (spec §12, §47)",
    repoUrl: "https://github.com/MITHQALMTQ/MTQ",
    productionUrl: "https://mithqal.vercel.app/",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "CONFIDENTIAL",
    modelPolicy: "HIGH_QUALITY",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:publishEvent"],
    riskCeiling: "MEDIUM",
    capabilities: ["research", "classify", "analyze", "compare"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "learning.observation"],
    domainTools: ["mtq.market.lookup", "mtq.risk.signal", "mtq.asset.classify"],
    governanceBoundary: "analysis ≠ authorization; recommendation ≠ transaction execution (§12, §47).",
    personality: { tone: "analytical", vocabulary: ["settlement", "market", "reserve"], systemPromptSuffix: "MTQ context: financial market intelligence. No autonomous execution." },
  },
  {
    slug: "judge_smart",
    name: "JUDGE_SMART",
    displayName: "Judge-Smart",
    domain: "justice",
    description: "Egyptian Judicial Smart Platform — case retrieval, legal knowledge, precedent retrieval, evidence organization, summarization. (spec §13, §46)",
    repoUrl: "https://github.com/fortleem/judge_synapse",
    productionUrl: "https://judge-smart.vercel.app/",
    knowledgeScope: "TENANT",
    memoryScope: "ORGANIZATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "RESTRICTED",
    modelPolicy: "HIGH_QUALITY",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:tools.execute", "brain:publishEvent"],
    riskCeiling: "HIGH",
    capabilities: ["research", "retrieve", "summarize", "classify", "extract", "compare", "plan"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "brain.memory.candidate", "learning.observation", "learning.evaluation_case"],
    domainTools: ["judge.case.retrieve", "judge.precedent.search", "judge.evidence.organize", "judge.timeline.construct"],
    governanceBoundary: "Brain must NOT autonomously make final legal judgments (§13, §46). AI assistance + evidence + human/legal authority required.",
    personality: { tone: "judicious", vocabulary: ["case", "precedent", "evidence"], systemPromptSuffix: "Judge-Smart context: legal research assistance. Never autonomous judicial decisions." },
  },
  {
    slug: "egycourt",
    name: "EGYCOURT",
    displayName: "EgyCourt",
    domain: "justice",
    description: "Court workflow system — case model, documents, roles, permissions, legal data. (spec §14)",
    repoUrl: "https://github.com/egycourt/egycourt",
    knowledgeScope: "TENANT",
    memoryScope: "ORGANIZATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "RESTRICTED",
    modelPolicy: "HIGH_QUALITY",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read"],
    riskCeiling: "HIGH",
    capabilities: ["research", "retrieve", "summarize", "classify"],
    eventTypes: ["brain.application.request", "brain.user.feedback"],
    domainTools: ["egycourt.case.lookup", "egycourt.document.search"],
    governanceBoundary: "High-sensitivity court data — no unrestricted global Brain access (§14, §94).",
    personality: { tone: "judicious", vocabulary: ["court", "case", "ruling"], systemPromptSuffix: "EgyCourt context: court workflow assistance. Human/legal authority required." },
  },
  {
    slug: "sgtx_fable",
    name: "SGTX_FABLE",
    displayName: "SGTX Fable",
    domain: "trade",
    description: "SGTX Platform v12 — 9 portals (trader, logistics, financier, QC, lab, gov, admin, marketplace), Loom audit. (spec §15)",
    repoUrl: "https://github.com/fortleem/SGTX_FABLE",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "CONFIDENTIAL",
    modelPolicy: "HIGH_QUALITY",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:publishEvent"],
    riskCeiling: "HIGH",
    capabilities: ["research", "classify", "summarize", "verify"],
    eventTypes: ["brain.application.request", "brain.user.feedback"],
    domainTools: ["fable.portal.lookup", "fable.shipment.trace"],
    governanceBoundary: "FABLE data is application-scoped, NOT globally shareable (§15).",
    personality: { tone: "operational", vocabulary: ["portal", "shipment", "FeeLock"], systemPromptSuffix: "SGTX FABLE context: trade portal intelligence." },
  },
  {
    slug: "ppe",
    name: "PPE",
    displayName: "PPE Compliance",
    domain: "compliance",
    description: "PPE compliance detector — helmet/vest detection, few-shot learning, real dataset. (spec §16)",
    repoUrl: "https://github.com/fortleem/PPE",
    productionUrl: "https://ppe-smart.vercel.app",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "INTERNAL",
    modelPolicy: "BALANCED",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:tools.execute", "brain:publishEvent"],
    riskCeiling: "MEDIUM",
    capabilities: ["classify", "verify", "extract"],
    eventTypes: ["brain.application.request", "brain.tool.outcome", "brain.user.feedback", "learning.observation"],
    domainTools: ["ppe.helmet.detect", "ppe.vest.detect", "ppe.image.classify"],
    governanceBoundary: "PPE namespace + evaluation suite (§16).",
    personality: { tone: "safety-focused", vocabulary: ["PPE", "helmet", "vest", "compliance"], systemPromptSuffix: "PPE context: compliance detection assistance." },
  },
  {
    slug: "mtq_sigma",
    name: "MTQ_SIGMA",
    displayName: "MTQ Sigma",
    domain: "finance",
    description: "MTQΣ — non-USD multi-currency reference unit, 110% collateralized reserve, Monte Carlo + on-chain tests. (spec §17, §47)",
    repoUrl: "https://github.com/MITHQALMTQ/MTQ_SIGMA",
    productionUrl: "https://mtq-sigma.vercel.app/",
    knowledgeScope: "APPLICATION",
    memoryScope: "APPLICATION",
    toolScope: "APPLICATION",
    dataClassCeiling: "CONFIDENTIAL",
    modelPolicy: "HIGH_QUALITY",
    allowedBrainScopes: ["brain:respond", "brain:retrieve", "brain:memory.read", "brain:publishEvent"],
    riskCeiling: "HIGH",
    capabilities: ["research", "classify", "analyze", "compare"],
    eventTypes: ["brain.application.request", "brain.user.feedback", "learning.observation"],
    domainTools: ["mtq_sigma.reserve.lookup", "mtq_sigma.collateral.check", "mtq_sigma.montecarlo.run"],
    governanceBoundary: "Separate application_id, policy, scope from MTQ (§17). External financial actions require application authorization (§47).",
    personality: { tone: "analytical", vocabulary: ["reserve", "collateral", "reference unit"], systemPromptSuffix: "MTQΣ context: multi-currency reserve intelligence. No autonomous execution." },
  },
];

export function getPlatformBySlug(slug: string): PlatformCatalogEntry | undefined {
  return PLATFORM_CATALOG.find((p) => p.slug === slug);
}

export function listPlatforms(): PlatformCatalogEntry[] {
  return PLATFORM_CATALOG;
}
