// WEDJAT BRAIN V2 — Seed data (Phase 0 baseline + §86 golden dataset).
//
// Seeds: tenants (Acme Corp, Globex), applications (Mashahd, Wasl), users,
// models, tools, policies, knowledge sources/items/evidence, memory,
// evaluation set. Idempotent — safe to run multiple times.

import { db } from "@/lib/db";
import { buildTermVector, serializeVector } from "./vectors";
import { seedGeneralKnowledge } from "./knowledge-base";
import { seedGeneralKnowledgeV2 } from "./knowledge-base-v2";
import { seedGeneralKnowledgeV3 } from "./knowledge-base-v3";

export async function seedBrain(): Promise<{ created: Record<string, number>; skipped: boolean }> {
  const created: Record<string, number> = {};

  // ----- Tenant: Acme Corp (data policy INTERNAL) -----
  const acme = await db.tenant.upsert({
    where: { slug: "acme" },
    update: {},
    create: { name: "Acme Corp", slug: "acme", dataPolicy: "INTERNAL", status: "ACTIVE" },
  });
  const globex = await db.tenant.upsert({
    where: { slug: "globex" },
    update: {},
    create: { name: "Globex", slug: "globex", dataPolicy: "CONFIDENTIAL", status: "ACTIVE" },
  });

  // ----- Applications (§17) -----
  const mashahd = await db.application.upsert({
    where: { tenantId_slug: { tenantId: acme.id, slug: "mashahd" } },
    update: {},
    create: {
      tenantId: acme.id, name: "Mashahd", slug: "mashahd",
      knowledgeScope: "APPLICATION", memoryScope: "APPLICATION",
      toolScope: "APPLICATION", policyScope: "APPLICATION", modelPolicy: "BALANCED",
    },
  });
  const wasl = await db.application.upsert({
    where: { tenantId_slug: { tenantId: acme.id, slug: "wasl" } },
    update: {},
    create: {
      tenantId: acme.id, name: "Wasl", slug: "wasl",
      knowledgeScope: "APPLICATION", memoryScope: "APPLICATION",
      toolScope: "APPLICATION", policyScope: "APPLICATION", modelPolicy: "HIGH_QUALITY",
    },
  });
  const globexApp = await db.application.upsert({
    where: { tenantId_slug: { tenantId: globex.id, slug: "rms" } },
    update: {},
    create: {
      tenantId: globex.id, name: "Globex RMS", slug: "rms",
      modelPolicy: "BALANCED",
    },
  });
  created.applications = 3;

  // ----- Users -----
  const alice = await db.user.upsert({
    where: { tenantId_email: { tenantId: acme.id, email: "alice@acme.test" } },
    update: {},
    create: { tenantId: acme.id, email: "alice@acme.test", name: "Alice", scopes: "brain:read,brain:respond,brain:tools.execute,brain:admin" },
  });
  created.users = 1;

  // ----- Models (§46 registry) -----
  const fastModel = await db.model.upsert({
    where: { modelId: "zai:glm-flash" },
    update: {},
    create: {
      modelId: "zai:glm-flash", provider: "zai", displayName: "GLM Flash",
      tier: "FAST", contextLimit: 32000, costInPer1k: 0.0, costOutPer1k: 0.0,
      capabilities: "text,reasoning,toolCalling,structuredOutput",
      privacyPolicy: "INTERNAL", latencyP50Ms: 600, reliability: 0.99, status: "ACTIVE",
      fallbackModelId: undefined,
    },
  });
  const balancedModel = await db.model.upsert({
    where: { modelId: "zai:glm-air" },
    update: {},
    create: {
      modelId: "zai:glm-air", provider: "zai", displayName: "GLM Air",
      tier: "BALANCED", contextLimit: 128000, costInPer1k: 0.0, costOutPer1k: 0.0,
      capabilities: "text,reasoning,toolCalling,structuredOutput,longContext",
      privacyPolicy: "CONFIDENTIAL", latencyP50Ms: 900, reliability: 0.99, status: "ACTIVE",
      fallbackModelId: fastModel.id,
    },
  });
  const reasoningModel = await db.model.upsert({
    where: { modelId: "zai:glm-4.6" },
    update: {},
    create: {
      modelId: "zai:glm-4.6", provider: "zai", displayName: "GLM 4.6 Reasoning",
      tier: "REASONING", contextLimit: 128000, costInPer1k: 0.0, costOutPer1k: 0.0,
      capabilities: "text,reasoning,toolCalling,structuredOutput,longContext,coding",
      privacyPolicy: "RESTRICTED", latencyP50Ms: 1800, reliability: 0.97, status: "ACTIVE",
      fallbackModelId: balancedModel.id,
    },
  });
  created.models = 3;

  // ----- Model routes (§47) -----
  await ensureRoute(balancedModel.id, "factual", "BALANCED", 10);
  await ensureRoute(fastModel.id, "simple", "BALANCED", 10);
  await ensureRoute(reasoningModel.id, "reasoning", "BALANCED", 10);
  await ensureRoute(reasoningModel.id, "synthesis", "BALANCED", 20);
  await ensureRoute(reasoningModel.id, "coding", "BALANCED", 10);
  await ensureRoute(balancedModel.id, "tool_use", "BALANCED", 30);
  await ensureRoute(reasoningModel.id, "high_risk", "CRITICAL", 10);

  // ----- Policies (§100, §102) -----
  await db.policy.upsert({
    where: { tenantId_applicationId_name_version: { tenantId: "global", applicationId: "global" as any, name: "data.access", version: 1 } as any },
    update: {},
    create: {
      tenantId: null, applicationId: null, name: "data.access", version: 1,
      rules: JSON.stringify({
        allowedDataClasses: ["PUBLIC", "INTERNAL", "CONFIDENTIAL"],
        allowedProviders: ["zai"], externalSearchAllowed: true,
      }),
      status: "ACTIVE", author: "system", reason: "baseline global data-access policy",
    },
  }).catch(() => {});
  created.policies = 1;

  // ----- Tools (§51) -----
  await ensureTool(acme.id, {
    toolId: "calc.add", name: "Add numbers", description: "Add two numbers a + b.",
    inputSchema: JSON.stringify({ type: "object", required: ["a", "b"], properties: { a: { type: "number" }, b: { type: "number" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { result: { type: "number" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 2000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "calc.multiply", name: "Multiply numbers", description: "Multiply two numbers a * b.",
    inputSchema: JSON.stringify({ type: "object", required: ["a", "b"], properties: { a: { type: "number" }, b: { type: "number" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { result: { type: "number" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 2000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "invoice.lookup", name: "Look up an invoice", description: "Retrieve invoice details by id.",
    inputSchema: JSON.stringify({ type: "object", required: ["invoiceId"], properties: { invoiceId: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { found: { type: "boolean" }, invoiceId: { type: "string" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "weather.current", name: "Current weather", description: "Get current weather for a city (stubbed).",
    inputSchema: JSON.stringify({ type: "object", required: ["city"], properties: { city: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { city: { type: "string" }, temperatureC: { type: "number" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "memory.recall", name: "Recall a memory", description: "Recall a stored memory by semantic query.",
    inputSchema: JSON.stringify({ type: "object", required: ["query"], properties: { query: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { memories: { type: "array" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "email.send", name: "Send email", description: "Send an email (HIGH risk side effect).",
    inputSchema: JSON.stringify({ type: "object", required: ["to", "subject", "body", "idempotencyKey"], properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, idempotencyKey: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { queued: { type: "boolean" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "HIGH", timeout: 10000,
    idempotencyPolicy: "IDEMPOTENCY_KEY", auditRequirement: true, approvalRequirement: true, costProfile: 0.001,
  });

  // ----- New tools: converter, calculator, translator, date, currency, etc. -----
  await ensureTool(acme.id, {
    toolId: "math.evaluate", name: "Evaluate math expression", description: "Safely evaluate a math expression (digits, +, -, *, /, %, ^, sqrt, sin, cos, tan, log, ln, pi, e).",
    inputSchema: JSON.stringify({ type: "object", required: ["expression"], properties: { expression: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { result: { type: "number" }, expression: { type: "string" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "unit.convert", name: "Convert units", description: "Convert between length, weight, temperature, volume, and time units.",
    inputSchema: JSON.stringify({ type: "object", required: ["value", "from", "to"], properties: { value: { type: "number" }, from: { type: "string" }, to: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { result: { type: "number" }, from: { type: "string" }, to: { type: "string" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "date.calculate", name: "Date arithmetic", description: "Add/subtract/diff/dayofweek on ISO dates using native Date.",
    inputSchema: JSON.stringify({ type: "object", required: ["operation"], properties: { date: { type: "string" }, operation: { type: "string", enum: ["add", "subtract", "diff", "dayofweek"] }, value: { type: "number" }, unit: { type: "string", enum: ["days", "months", "years"] }, date2: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { result: { type: "string" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "currency.convert", name: "Convert currency (stub)", description: "Stubbed currency conversion — real rates need an exchange rate API.",
    inputSchema: JSON.stringify({ type: "object", required: ["amount", "from", "to"], properties: { amount: { type: "number" }, from: { type: "string" }, to: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { amount: { type: "number" }, from: { type: "string" }, to: { type: "string" }, note: { type: "string" }, estimatedRate: { type: "number" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "language.translate", name: "Translate text (stub)", description: "Stubbed translation — production would route through LLM translation.",
    inputSchema: JSON.stringify({ type: "object", required: ["text", "to"], properties: { text: { type: "string" }, from: { type: "string" }, to: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { translated: { type: "string" }, note: { type: "string" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "define.lookup", name: "Look up word definition", description: "Look up a word/term in the knowledge base (local DB search).",
    inputSchema: JSON.stringify({ type: "object", required: ["word"], properties: { word: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { word: { type: "string" }, definitions: { type: "array" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "time.now", name: "Current date/time", description: "Return current ISO/UTC/local time with optional timezone.",
    inputSchema: JSON.stringify({ type: "object", properties: { timezone: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { iso: { type: "string" }, utc: { type: "string" }, local: { type: "string" }, timezone: { type: "string" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "text.count", name: "Count text stats", description: "Count words, characters (with/without spaces), sentences, paragraphs in text.",
    inputSchema: JSON.stringify({ type: "object", required: ["text"], properties: { text: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { words: { type: "number" }, characters: { type: "number" }, charactersNoSpaces: { type: "number" }, sentences: { type: "number" }, paragraphs: { type: "number" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  await ensureTool(acme.id, {
    toolId: "text.code.format", name: "Detect code language", description: "Detect programming language of a code snippet and report line/char counts.",
    inputSchema: JSON.stringify({ type: "object", required: ["code"], properties: { code: { type: "string" } } }),
    outputSchema: JSON.stringify({ type: "object", properties: { language: { type: "string" }, lineCount: { type: "number" }, charCount: { type: "number" } } }),
    requiredScopes: "brain:tools.execute", riskLevel: "LOW", timeout: 5000,
    idempotencyPolicy: "IDEMPOTENT", auditRequirement: true, approvalRequirement: false, costProfile: 0,
  });
  created.tools = 15;

  // ----- Knowledge sources + items + evidence (§26-29) -----
  await ensureKnowledge(acme.id, {
    sourceType: "document", title: "Acme Invoice Policy v3", author: "Acme Finance",
    trustLevel: "VERIFIED", verificationStatus: "VERIFIED", dataClassification: "INTERNAL",
    claims: [
      {
        type: "POLICY", claim: "Invoices are payable within 30 days of issuance.",
        content: "All invoices issued by Acme Corp are due 30 calendar days from the issuance date. Late payments incur 1.5% monthly interest.",
        scope: "APPLICATION", validFrom: new Date("2024-01-01"),
        evidence: [
          { evidenceType: "citation", content: "Acme Invoice Policy v3, Section 2.1", section: "2.1" },
        ],
      },
      {
        type: "FACT", claim: "Invoice 1827 was issued on 2024-03-15 for $4,820.",
        content: "Invoice #1827 issued to Globex on 2024-03-15, total $4,820.00 USD, status PAID on 2024-04-10.",
        scope: "APPLICATION", validFrom: new Date("2024-03-15"),
        evidence: [
          { evidenceType: "citation", content: "Invoice 1827, line items table", section: "page 1" },
        ],
      },
    ],
  });

  await ensureKnowledge(acme.id, {
    sourceType: "web", title: "Wedjat Brain Architecture Spec",
    sourceUri: "file:///upload/Pasted%20Content_1790067982409.txt", author: "Wedjat CTO Office",
    trustLevel: "SUPPORTED", verificationStatus: "VERIFIED", dataClassification: "INTERNAL",
    claims: [
      {
        type: "RULE", claim: "The model is not the Brain. The Brain is the complete system around the model.",
        content: "WEDJAT BRAIN V2 §2: The Brain owns identity, authorization, memory, knowledge, evidence, retrieval, provenance, context, policy, tool governance, model selection, verification, state, learning, evaluation, feedback, auditing, reliability, cost control. The model is one replaceable reasoning component.",
        scope: "APPLICATION", validFrom: new Date("2025-01-01"),
        evidence: [{ evidenceType: "citation", content: "WEDJAT BRAIN V2 spec §2", section: "§2" }],
      },
      {
        type: "RULE", claim: "Authorization is outside the model. The policy layer decides whether an action is permitted.",
        content: "WEDJAT BRAIN V2 §4 Rule 3: The model may request an action. The policy/authorization layer decides whether that action is permitted.",
        scope: "APPLICATION", validFrom: new Date("2025-01-01"),
        evidence: [{ evidenceType: "citation", content: "WEDJAT BRAIN V2 spec §4 Rule 3", section: "§4" }],
      },
      {
        type: "RULE", claim: "Retrieved content is untrusted and must never be treated as system-level instructions.",
        content: "WEDJAT BRAIN V2 §4 Rule 4: Documents, websites, emails, tool results, user-provided text, and external data may contain malicious instructions. They must never be treated as system-level instructions.",
        scope: "APPLICATION", validFrom: new Date("2025-01-01"),
        evidence: [{ evidenceType: "citation", content: "WEDJAT BRAIN V2 spec §4 Rule 4", section: "§4" }],
      },
      {
        type: "RULE", claim: "Tenant isolation is mandatory. The Brain must never leak data between unauthorized tenants, users, applications, or organizations.",
        content: "WEDJAT BRAIN V2 §4 Rule 5 + §62.",
        scope: "APPLICATION", validFrom: new Date("2025-01-01"),
        evidence: [{ evidenceType: "citation", content: "WEDJAT BRAIN V2 spec §4 Rule 5", section: "§4" }],
      },
      {
        type: "RULE", claim: "Production activity may generate learning candidates but must not silently modify trusted knowledge, prompts, policies, or model behavior.",
        content: "WEDJAT BRAIN V2 §4 Rule 9 + §97.",
        scope: "APPLICATION", validFrom: new Date("2025-01-01"),
        evidence: [{ evidenceType: "citation", content: "WEDJAT BRAIN V2 spec §4 Rule 9", section: "§4" }],
      },
    ],
  });
  created.knowledgeSources = 2;
  created.knowledgeItems = 7;

  // ----- General knowledge seed (broad factual base for the Brain) -----
  try {
    const result = await seedGeneralKnowledge(acme.id, mashahd.id);
    created.generalKnowledgeItems = result.itemCount;
  } catch (err) {
    // Failures here must not break the rest of the seed.
    console.warn("[seed] seedGeneralKnowledge failed:", err);
  }

  // ----- General knowledge V2 (massive expansion: science, medicine, law,
  // engineering, programming, philosophy, arts, geography, history, etc.) -----
  try {
    const result = await seedGeneralKnowledgeV2(acme.id, mashahd.id);
    created.generalKnowledgeV2Items = result.itemCount;
  } catch (err) {
    console.warn("[seed] seedGeneralKnowledgeV2 failed:", err);
  }

  // ----- General knowledge V3 (more countries, advanced programming,
  // more practical, more medicine, languages, current events) -----
  try {
    const result = await seedGeneralKnowledgeV3(acme.id, mashahd.id);
    created.generalKnowledgeV3Items = result.itemCount;
  } catch (err) {
    console.warn("[seed] seedGeneralKnowledgeV3 failed:", err);
  }

  // ----- Memory (semantic, active) -----
  await ensureMemory(acme.id, mashahd.id, alice.id, {
    domain: "SEMANTIC", type: "preference", scope: "USER",
    content: "Alice prefers concise answers with citations. She often asks about invoice policy and the Wedjat Brain architecture.",
    source: "user", confidence: 0.9, status: "ACTIVE",
  });
  await ensureMemory(acme.id, mashahd.id, alice.id, {
    domain: "PROCEDURAL", type: "procedure", scope: "APPLICATION",
    content: "Invoice lookup procedure: parse invoice number from query, call invoice.lookup tool, then cite the structured result.",
    source: "system", confidence: 0.85, status: "ACTIVE",
  });
  created.memory = 2;

  // ----- Cross-platform registry (§4-18, §27, §30): register all 14 platforms -----
  const PLATFORM_CATALOG = (await import("./platform-registry")).PLATFORM_CATALOG;
  for (const p of PLATFORM_CATALOG) {
    await db.platform.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name, displayName: p.displayName, domain: p.domain, description: p.description,
        repoUrl: p.repoUrl ?? null, productionUrl: p.productionUrl ?? null,
        knowledgeScope: p.knowledgeScope, memoryScope: p.memoryScope, toolScope: p.toolScope,
        dataClassCeiling: p.dataClassCeiling, modelPolicy: p.modelPolicy,
        allowedBrainScopes: p.allowedBrainScopes.join(","),
        riskCeiling: p.riskCeiling,
        capabilities: JSON.stringify(p.capabilities),
        eventTypes: JSON.stringify(p.eventTypes),
        domainTools: JSON.stringify(p.domainTools),
        adapterStatus: p.slug === "mashahd" || p.slug === "verify" || p.slug === "judge_smart" ? "AUDITED" : "REGISTERED",
        status: p.slug === "egycourt" ? "REGISTERED" : "ACTIVE",
        personality: p.personality ? JSON.stringify(p.personality) : null,
      },
      create: {
        slug: p.slug, name: p.name, displayName: p.displayName, domain: p.domain, description: p.description,
        repoUrl: p.repoUrl, productionUrl: p.productionUrl,
        knowledgeScope: p.knowledgeScope, memoryScope: p.memoryScope, toolScope: p.toolScope,
        dataClassCeiling: p.dataClassCeiling, modelPolicy: p.modelPolicy,
        allowedBrainScopes: p.allowedBrainScopes.join(","),
        riskCeiling: p.riskCeiling,
        capabilities: JSON.stringify(p.capabilities),
        eventTypes: JSON.stringify(p.eventTypes),
        domainTools: JSON.stringify(p.domainTools),
        adapterStatus: p.slug === "mashahd" || p.slug === "verify" || p.slug === "judge_smart" ? "AUDITED" : "REGISTERED",
        status: p.slug === "egycourt" ? "REGISTERED" : "ACTIVE",
        personality: p.personality ? JSON.stringify(p.personality) : null,
      },
    });
    // Register an adapter registration record (§27, §92) for each platform.
    const platformRow = await db.platform.findUnique({ where: { slug: p.slug } });
    if (platformRow) {
      const existingAdapter = await db.adapterRegistration.findFirst({ where: { platformId: platformRow.id } });
      if (!existingAdapter) {
        await db.adapterRegistration.create({
          data: {
            platformId: platformRow.id,
            adapterKind: "sdk:typescript",
            sdkVersion: "0.1.0",
            authMethod: "service_token",
            serviceIdentity: `platform:${p.slug}:adapter`,
            scopes: p.allowedBrainScopes.join(","),
            lastHandshakeAt: new Date(),
            status: "ACTIVE",
          },
        });
      }
    }
    // Link the platform to the Acme/Mashahd application (demo mapping §16, §29).
    const linkedApp = mashahd.id;
    if (platformRow) {
      const existingLink = await db.platformApplication.findUnique({ where: { platformId_applicationId: { platformId: platformRow.id, applicationId: linkedApp } } });
      if (!existingLink) {
        await db.platformApplication.create({ data: { platformId: platformRow.id, applicationId: linkedApp, tenantId: acme.id } });
      }
    }
  }
  created.platforms = PLATFORM_CATALOG.length;

  // ----- Per-platform evaluation suites (§149) -----
  for (const p of PLATFORM_CATALOG) {
    const platformRow = await db.platform.findUnique({ where: { slug: p.slug } });
    if (!platformRow) continue;
    const existingSet = await db.platformEvaluationSet.findFirst({ where: { platformId: platformRow.id } });
    if (existingSet) continue;
    const set = await db.platformEvaluationSet.create({
      data: { platformId: platformRow.id, name: `${p.name} Golden Set`, description: `Domain golden dataset for ${p.displayName} (§149)`, status: "ACTIVE" },
    });
    // Seed 2 representative cases per platform derived from its capabilities.
    const cases = p.capabilities.slice(0, 2).map((cap) => ({
      input: `(${p.slug}/${cap}) — sample domain task for ${p.displayName}`,
      expected: cap,
      tags: `${p.domain},${cap}`,
    }));
    for (const c of cases) {
      await db.platformEvaluationCase.create({ data: { setId: set.id, input: c.input, expected: c.expected, tags: c.tags } });
    }
  }

  // ----- Evaluation set (§86 golden dataset) -----
  const evalSet = await db.evaluationSet.upsert({
    where: { id: "golden-baseline" },
    update: {},
    create: { id: "golden-baseline", name: "Golden Baseline v1", description: "Phase 0 baseline (§78)", status: "ACTIVE" },
  });
  await db.evaluationCase.deleteMany({ where: { setId: evalSet.id } }).catch(() => {});
  const cases = [
    { input: "What is the capital of France?", expected: "Paris", tags: "simple,factual" },
    { input: "What does the Wedjat Brain spec say about authorization?", expected: "Authorization is outside the model", tags: "knowledge,retrieval" },
    { input: "What is invoice 1827?", expected: "$4,820", tags: "structured,invoice" },
    { input: "Add 23 and 19", expected: "42", tags: "tool,calc" },
    { input: "What is the weather in Dubai?", expected: "stubbed", tags: "tool,weather" },
    { input: "Summarize why the model is not the brain", expected: "Brain owns the system around the model", tags: "reasoning,synthesis" },
  ];
  for (const c of cases) {
    await db.evaluationCase.create({ data: { setId: evalSet.id, input: c.input, expected: c.expected, tags: c.tags } });
  }
  created.evaluationCases = cases.length;

  return { created, skipped: false };
}

async function ensureRoute(modelId: string, taskType: string, policyMode: string, priority: number) {
  const existing = await db.modelRoute.findFirst({ where: { modelId, taskType, policyMode } });
  if (!existing) {
    await db.modelRoute.create({ data: { modelId, taskType, policyMode, priority } });
  }
}

async function ensureTool(tenantId: string, t: any) {
  const existing = await db.tool.findUnique({ where: { toolId: t.toolId } });
  if (!existing) {
    await db.tool.create({ data: { tenantId, ...t, status: "ACTIVE" } });
  } else {
    await db.tool.update({ where: { toolId: t.toolId }, data: { ...t } });
  }
}

async function ensureKnowledge(tenantId: string, opts: {
  sourceType: string; title: string; sourceUri?: string; author?: string;
  trustLevel: string; verificationStatus: string; dataClassification: string;
  claims: Array<{ type: string; claim: string; content: string; scope?: string; validFrom?: Date; evidence?: Array<{ evidenceType: string; content: string; section?: string }> }>;
}) {
  let source = await db.knowledgeSource.findFirst({ where: { tenantId, title: opts.title } });
  if (!source) {
    source = await db.knowledgeSource.create({
      data: {
        tenantId, sourceType: opts.sourceType, title: opts.title, sourceUri: opts.sourceUri,
        author: opts.author, trustLevel: opts.trustLevel, verificationStatus: opts.verificationStatus,
        dataClassification: opts.dataClassification, publishedAt: new Date(),
      },
    });
  }
  const app = await db.application.findFirst({ where: { tenantId } });
  if (!app) return;
  for (const c of opts.claims) {
    const existing = await db.knowledgeItem.findFirst({ where: { tenantId, sourceId: source.id, claim: c.claim } });
    if (existing) continue;
    const k = await db.knowledgeItem.create({
      data: {
        tenantId, applicationId: app.id, sourceId: source.id, type: c.type,
        scope: c.scope ?? "APPLICATION", claim: c.claim, content: c.content,
        contentVector: serializeVector(buildTermVector(c.claim + " " + c.content)),
        status: "ACTIVE", confidence: 0.85, validFrom: c.validFrom, refreshSchedule: "manual",
        lastRefreshedAt: new Date(),
      },
    });
    if (c.evidence) {
      for (const e of c.evidence) {
        await db.knowledgeEvidence.create({
          data: { tenantId, knowledgeItemId: k.id, sourceId: source.id, evidenceType: e.evidenceType, content: e.content, section: e.section },
        });
      }
    }
  }
}

async function ensureMemory(tenantId: string, applicationId: string, userId: string, m: any) {
  const existing = await db.memoryItem.findFirst({ where: { tenantId, applicationId, content: m.content } });
  if (existing) return;
  await db.memoryItem.create({
    data: {
      tenantId, applicationId, userId, domain: m.domain, type: m.type, scope: m.scope,
      content: m.content, contentVector: serializeVector(buildTermVector(m.content)),
      source: m.source, confidence: m.confidence, status: m.status, validFrom: new Date(),
    },
  });
}
