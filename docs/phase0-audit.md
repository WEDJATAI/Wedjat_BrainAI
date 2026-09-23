# WEDJAT BRAIN — Phase 0 Ecosystem Audit (§137)

> Per spec §186: *"Never claim a platform is integrated when only its repository has been inspected."*
> Per spec §185: *"FIRST do the complete Phase 0 audit"* — this document is that audit.
>
> Method: unauthenticated GitHub REST API (public read-only) + raw.githubusercontent.com for README/package.json (does NOT count against the 60 req/hour API rate limit). No tokens, no cloning, no authentication. All findings below are derived **only** from public metadata.

---

## Summary Table

| # | Platform | Repo (owner/name) | Public? | Primary Lang | Framework | Purpose (from API/README) | AI hints | DB hints | Status |
|---|----------|-------------------|---------|--------------|-----------|---------------------------|----------|----------|--------|
| 1 | CIRKLE-SUPERAPP | `cirkle-superapp/CIRKLE` | public | HTML | Next.js 16 + Prisma + shadcn/ui (New York) | Cirkle superapp hub (description empty; root has MASTER_BLUEPRINT, FINAL_REPORT, INTEGRATION, multiple audit reports) | none in package.json (but `socket.io-client`) | Prisma + libSQL/SQLite | inspectable |
| 2 | CIRKLE-MAIL | `cirkle-superapp/MAIL` | public | TypeScript | Next.js 16 + Prisma + shadcn/ui | Gmail-like email client w/ Cirkle gold/teal brand, snooze, undo-send, drafts, labels | `z-ai-web-dev-sdk` | Prisma (SQLite implied) | inspectable |
| 3 | OLYMPEX | `fortleem/olympex_export` | public | TypeScript | Next.js 16 (App Router, Turbopack) + Prisma + shadcn/ui + react-hook-form/zod | Egyptian fresh/frozen produce exporter corporate site + RFQ pipeline + hardened public API | `z-ai-web-dev-sdk` | Prisma + SQLite | inspectable |
| 4 | MASHAHD | `cirkle-superapp/mashahd` | public | HTML | Next.js 16 + Prisma + shadcn/ui | Video streaming app (multi-service: dev:app / dev:tracker / dev:party); heavy docs (MASTER_BLUEPRINT, ZERO_COST_ARCHITECTURE, MEDIA_FABRIC_CHECKLIST, P2P_NETWORKING) | none in package.json | Prisma + libSQL/SQLite (`@aws-sdk/client-s3`) | inspectable |
| 5 | VERIFY | `cirkle-superapp/verify` | public | TypeScript | Next.js 16 + React 19 + Prisma + shadcn/ui + Tailwind 4 | Arabic-first identity verification: 3-pass OCR, Egyptian National ID decode, MRZ TD1/TD3, live face match (VLM), liveness challenges, eval lab | `z-ai-web-dev-sdk` (VLM), `tesseract.js` | Prisma + libSQL/Turso + Neon serverless + Drizzle | inspectable |
| 6 | WASL | `cirkle-superapp/wasl` | public | HTML | Next.js 16 + Prisma + Socket.io + shadcn/ui | WhatsApp-like real-time chat: business accounts, AI-verified "commits" (hash + fairness check), polls, stories, voice messages | none in package.json | Prisma + libSQL/Turso (Turso production URL in README) | inspectable |
| 7 | AURIENTA | `Aurienta/Aurienta` | public | HTML | Next.js + Prisma + shadcn/ui | "Constitutional launchpad" — noncustodial constitutional infrastructure; transforms capital into real-economy corporate ownership | `@google/generative-ai`, `@huggingface/inference`, `groq-sdk`, `openai` (4 providers — **only repo NOT on z-ai**) | Prisma + libSQL/Turso | inspectable |
| 8 | SGTX | `SGTX-PILOT/SGTX` | public | TypeScript | Next.js + Prisma + shadcn/ui + @noble/ed25519 | Sovereign Governed Trade Execution — non-custodial, AI-governed trade execution engine, cryptographic cross-border trade | `z-ai-web-dev-sdk` | Prisma + libSQL + Postgres scripts (`db:push-postgres`) | inspectable |
| 9 | MTQ / MITHQAL | `MITHQALMTQ/MTQ` | public | — (None) | **none** — repo is effectively a stub | Neutral settlement capability next to existing banking infrastructure (concept only) | none | none | **stub** (LICENSE + 183-byte README only) |
| 10 | JUDGE-SMART | `fortleem/judge_synapse` | public | HTML | Next.js + Prisma + shadcn/ui | Egyptian Judicial Smart Platform V2.1 — case workspace (5 tabs), 14 gov portals, 39 legal texts with provenance, hybrid search, judge/system separation, audit log | `z-ai-web-dev-sdk` | Prisma + libSQL/Turso (`sync-turso` script) | inspectable |
| 11 | EGYCOURT | `egycourt/egycourt` | **404 Not Found** | n/a | n/a | n/a — **repo does not exist publicly** (org `egycourt` exists, `public_repos: 0`) | n/a | n/a | **not inspectable** |
| 12 | SGTX FABLE | `fortleem/SGTX_FABLE` | public | TypeScript | Next.js (per README "v12", "Sovereign Obsidian & Gold") — but **package.json is a 5-dep Hono/Vite stub** (`hono`, `@hono/vite-build`, `@hono/vite-dev-server`) → README and code disagree; the v12 Next.js app is **not** in this repo's current package.json | SGTX Platform v12 — 9 portals (trader, logistics, financier, QC, lab, gov, admin, marketplace), 1.5% FeeLock, USTN shipment identity, Loom audit | none in current package.json | none in current package.json | inspectable but **inconsistent** (README vs. package.json) |
| 13 | PPE | `fortleem/PPE` | public | TypeScript | Next.js + Prisma + shadcn/ui + Tailwind 4 + Zustand + recharts | PPE compliance detector (Helmet/Vest) — zero/few/many-shot experiments, Arabic technical report, PWA, real 111-image dataset; results: 94.7% exact match | `z-ai-web-dev-sdk` (VLM in-context learning) | Prisma + libSQL/Turso | inspectable |
| 14 | MTQ SIGMA | `MITHQALMTQ/MTQ_SIGMA` | public | TypeScript | Next.js + Prisma + shadcn/ui + recharts + ethers + socket.io-client | MTQΣ — non-USD multi-currency reference unit, 110% collateralized reserve (stablecoins + gold), Monte Carlo (10,300 runs) + on-chain tests (28), deployed on 4 testnets | `z-ai-web-dev-sdk` | Prisma + libSQL/Turso + Upstash Redis | inspectable |
| 15 | Wedjat_BrainAI | `WEDJATAI/Wedjat_BrainAI` | public | — (None) | **none — repo is a placeholder** | The Brain repo on GitHub — only contains a `LICENSE` file (11357 bytes). The actual Brain V2 widget code lives in `/home/z/my-project` per the local worklog (Task IDs 0–8). | n/a | n/a | **stub** (LICENSE only) |

**Counts:**
- **Public & inspectable (with substantive content):** 12
- **Public but stub/placeholder only:** 2 (MTQ, Wedjat_BrainAI)
- **404 / not inspectable:** 1 (egycourt/egycourt)
- **Total repos audited:** 15

---

## Per-Platform Detail

### 1. CIRKLE-SUPERAPP — `cirkle-superapp/CIRKLE`
- **Repo:** https://github.com/cirkle-superapp/CIRKLE
- **Status:** public (not archived, not fork), 38.9 MB
- **Language:** HTML (GitHub primary-language heuristic; package.json confirms TypeScript + Next.js)
- **Framework:** Next.js 16 + Prisma + shadcn/ui (New York) + Tailwind 4 — package name `nextjs_tailwind_shadcn_ts`. Uses `@aws-sdk/client-s3`, `@libsql/client`, `@prisma/adapter-libsql`, `next-auth`, `next-intl`, `next-themes`, `socket.io-client`, `@tanstack/react-query`, `@tanstack/react-table`.
- **Description:** (empty on GitHub API). Root directory contains heavy documentation: `MASTER_BLUEPRINT.md` (74 KB), `FINAL_REPORT.md`, `INTEGRATION.md`, `COO_AUDIT_REPORT.md`, `COO_AUDIT_REPORT_v2.md`, `PHASE0_INSPECTION_REPORT.md` (32 KB), `PRODUCTION_GATE.md`, `ZERO_COST_ARCHITECTURE.md`, `MEDIA_FABRIC_CHECKLIST.md`, `worklog.md` (645 KB). **No README.md present at root.**
- **Homepage:** https://cirkle-superapp-psi.vercel.app
- **Default branch:** `main`. Last pushed: 2026-09-20.
- **Brain integration domain (spec §4.1 candidates):** users, social graph, identity, content catalog, recommendations — TBD pending integration phase.
- **Audit notes:** CIRKLE appears to be the super-app hub for the `cirkle-superapp/*` family (MAIL, mashahd, verify, wasl all reference the CIRKLE brand). Files like `INTEGRATION.md` and `PHASE0_INSPECTION_REPORT.md` suggest this repo may already contain cross-platform integration intent — worth deeper read in a later phase. **No README** — first integration blocker: need at minimum a README to expose platform capabilities to the Brain.

### 2. CIRKLE-MAIL — `cirkle-superapp/MAIL`
- **Repo:** https://github.com/cirkle-superapp/MAIL
- **Status:** public, 3.2 MB
- **Language:** TypeScript
- **Framework:** Next.js 16 + Prisma + shadcn/ui + react-hook-form + zod. Package name `cirkle-mail`. Scripts: `dev`, `build`, `start`, `lint`, `test`, `db:push/generate/migrate/reset`, `vercel-build`.
- **Description:** (empty on API). README is rich: "A fast, distraction-free email client — mails only — premium gold + teal design system + animated three-ring logo." Three-column layout, snooze, undo-send (5s window), real drafts, recipient autocomplete, bulk actions, thread view, full-text search.
- **Homepage:** https://cirkle-mail.vercel.app
- **Last pushed:** 2026-09-22 (most recent push in the audit).
- **Brain integration domain (§4.1):** `communications.email` — send/receive, drafts, threads, labels, search. Brain tools could include `mail.send`, `mail.draft.create`, `mail.search`, `mail.thread.reply`, `mail.snooze`.
- **Audit notes:** Clean README, z-ai-web-dev-sdk present. Strong candidate for early tool-adapter work — email is a high-leverage, well-scoped domain.

### 3. OLYMPEX — `fortleem/olympex_export`
- **Repo:** https://github.com/fortleem/olympex_export
- **Status:** public, 3.7 MB
- **Language:** TypeScript
- **Framework:** Next.js 16 (App Router + Turbopack) + Prisma + SQLite + shadcn/ui (New York) + Tailwind 4 + react-hook-form/zod. Manrope / Fraunces / Cinzel fonts. Single-page app with hash routing. Public API has rate limiting.
- **Description:** (empty on API). README: "Olymp Ex — Egyptian Fresh & Frozen Produce Exporter. Corporate site + RFQ pipeline + hardened public API." Single `DATABASE_URL=file:…/db/custom.db` env.
- **Homepage:** https://olymp-ex.vercel.app
- **Last pushed:** 2026-09-19.
- **Brain integration domain (§4.1):** `commerce.rfq`, `commerce.products`, `commerce.logistics` — RFQ submission, product catalog query, logistics status. Brain tools could include `olympex.rfq.submit`, `olympex.catalog.search`, `olympex.quote.status`.
- **Audit notes:** Z-ai present, Prisma schema is small/clean. Lowest-complexity integration target of the fortleem family.

### 4. MASHAHD — `cirkle-superapp/mashahd`
- **Repo:** https://github.com/cirkle-superapp/mashahd
- **Status:** public, 71 MB (largest Cirkle repo by size)
- **Language:** HTML
- **Framework:** Next.js 16 + Prisma + shadcn/ui + `@aws-sdk/client-s3` + `@libsql/client`. Multi-service runtime: `dev:app`, `dev:tracker`, `dev:party` (suggests app + tracker + partykit-style realtime). Package name `mashahd`.
- **Description:** "video streaming app" (terse).
- **Root files:** No README.md. Heavy docs: `MASTER_BLUEPRINT.md` (74 KB), `COO_AUDIT_REPORT_v2.md`, `PHASE0_INSPECTION_REPORT.md`, `ZERO_COST_ARCHITECTURE.md`, `MEDIA_MESH_V4_CHECKLIST.md`, `MEDIA_PIPELINE.md`, `P2P_NETWORKING.md`, `VIDEO_STREAMING_ARCHITECTURE.md`, `worklog.md` (645 KB).
- **Homepage:** https://mashahd.vercel.app
- **Last pushed:** 2026-09-22.
- **Brain integration domain (§4.1):** `media.video` — catalog, playback state, recommendations, watch history, transcoding pipeline status. Brain tools could include `mashahd.video.search`, `mashahd.playlist.create`, `mashahd.recommend`, `mashahd.tracker.stats`.
- **Audit notes:** Very large repo, complex multi-service. mashahd and Aurienta have **identical file sizes for every shared top-level file** (`bun.lock` 377,686 B, `worklog.md` 1,724,116 B, `PRODUCTION_READINESS_AUDIT.md` 23,199 B, etc.) — strong evidence they were forked from the same snapshot/template. mashahd's `worklog.md` is 1.7 MB — a long multi-agent implementation log.

### 5. VERIFY (Cirkle Identity Verification / دواير) — `cirkle-superapp/verify`
- **Repo:** https://github.com/cirkle-superapp/verify
- **Status:** public, 36.5 MB
- **Language:** TypeScript
- **Framework:** Next.js 16 + React 19 + TypeScript 5 + Prisma + shadcn/ui + Tailwind 4 + Zustand + recharts + `@napi-rs/canvas` + `tesseract.js` + `@neondatabase/serverless` + `drizzle-orm`/`drizzle-kit` (in addition to Prisma).
- **Description:** "live verification".
- **README highlights:** AI-powered live identity verification for Egyptian & Arabic documents, zero-cost, self-hosted, privacy-first. 3-pass Arabic OCR (image quality → Arabic-first OCR → field extraction), Egyptian 14-digit National ID decoder (gender/birthdate inference), MRZ TD1 (ID) + TD3 (passport) parsing, live face capture + VLM face match, liveness (3 random challenges), image quality scoring, training database, Evaluation Lab with per-field accuracy charts.
- **Homepage:** https://cirkle-verify.vercel.app
- **Last pushed:** 2026-09-21.
- **Brain integration domain (§4.1):** `identity.kyc`, `identity.document`, `identity.face`, `identity.liveness`. Brain tools could include `verify.id.egypt.decode`, `verify.mrz.parse`, `verify.face.match`, `verify.liveness.run`, `verify.report.issue`. **Strongly aligned with WEDJAT spec §62 (tenant identity) and §83-85 (verification).**
- **Audit notes:** Most Brain-aligned repo in the audit. The Verify domain semantics (provenance, evidence, validity) overlap heavily with the Brain's own knowledge/evidence model — Verify should be a high-priority integration partner. Uses **both Prisma and Drizzle** (Drizzle likely for Neon serverless edge reads) — adapter must account for two ORMs.

### 6. WASL — `cirkle-superapp/wasl`
- **Repo:** https://github.com/cirkle-superapp/wasl
- **Status:** public, 42.7 MB
- **Language:** HTML
- **Framework:** Next.js 16 + Prisma + Socket.io + shadcn/ui + `@libsql/client` (Turso production: `libsql://wasl-fortleem.aws-us-east-1.turso.io`). Package name `nextjs_tailwind_shadcn_ts`.
- **Description:** "chat app".
- **README highlights:** WhatsApp-like real-time chat. Auth (username/password, or login w/ Cirkle email/phone/username — already integrates with CIRKLE identity). Multi-phone numbers. Real-time messaging w/ typing/read receipts/presence/reactions/star/delete. Business accounts (verified, public/private groups). **AI-verified "commits"** (Cirkle-inspired) with hash + fairness check + two-party signatures + lifecycle (pending → active → completed). Admin review queue. Polls, stories (24h), voice messages, in-chat search.
- **Homepage:** https://cirkle-wasl.vercel.app
- **Last pushed:** 2026-09-22.
- **Brain integration domain (§4.1):** `social.conversation`, `social.commit`, `social.business`, `social.presence`. Brain tools could include `wasl.message.send`, `wasl.commit.create`, `wasl.commit.verify` (AI fairness check), `wasl.business.search`, `wasl.story.post`. The "AI-verified commit" pattern directly overlaps with WEDJAT spec §52-57 (governed tool execution + action state machine).
- **Audit notes:** Realtime stack (Socket.io) — Brain adapter will need an event bridge (NDJSON webhook subscription, not just REST). The "commit" lifecycle already implements a state machine; aligning with Brain's `PROPOSED → AUTHORIZED → EXECUTED → VERIFIED` is straightforward.

### 7. AURIENTA — `Aurienta/Aurienta`
- **Repo:** https://github.com/Aurienta/Aurienta
- **Status:** public, 69.7 MB
- **Language:** HTML
- **Framework:** Next.js + Prisma + shadcn/ui + Tailwind 4. Standalone build script (`build:standalone`). Dockerfile present.
- **Description:** "AURIENTA is a noncustodial constitutional infrastructure of structural trust. It transforms everyday capital into real-economy corporate ownership. The world's first constitutional launchpad — not crowdfunding, not speculation, not platform dependency."
- **Root files:** No README.md. `worklog.md` (1.7 MB — identical byte size to mashahd's worklog), `PRODUCTION_READINESS_AUDIT.md` (23 KB), `REPOSITORY_INTEGRITY.md`, `UI_AUDIT.md`.
- **AI providers (package.json):** `@google/generative-ai`, `@huggingface/inference`, `groq-sdk`, `openai`. **The only audited repo NOT standardized on `z-ai-web-dev-sdk`.** This is the single most important architectural divergence in the ecosystem.
- **DB:** Prisma + libSQL/Turso.
- **Homepage:** https://aurienta.vercel.app
- **Last pushed:** 2026-09-21.
- **Brain integration domain (§4.1):** `finance.constitutional`, `finance.ownership`, `capital.launchpad`. Brain tools could include `aurienta.capital.deploy`, `aurienta.ownership.transfer`, `aurienta.charter.verify`. Heavily speculative without deeper code access.
- **Audit notes:** Four parallel AI SDKs suggests AURIENTA was either (a) built before z-ai became the ecosystem standard, or (b) intentionally multi-provider. **Brain model abstraction (spec §45-48) must accommodate AURIENTA's existing SDK fan-out** if the Brain is to govern its AI calls. High architectural divergence — flag for Phase 1 reconciliation before any adapter is built.

### 8. SGTX — `SGTX-PILOT/SGTX`
- **Repo:** https://github.com/SGTX-PILOT/SGTX
- **Status:** public, 73.5 MB (largest repo overall besides mashahd)
- **Language:** TypeScript
- **Framework:** Next.js + Prisma + shadcn/ui + `@noble/ed25519` (Ed25519 signatures) + `@libsql/client`. Scripts include Postgres tooling (`db:push-postgres`, `db:validate-postgres`) and full test suite (`test`, `test:ci`, `test:e2e`, `test:coverage`).
- **Description:** "Sovereign Governed Trade Execution (SGTX) — Non-custodial, AI-governed trade execution engine. Zero-cost, sovereign infrastructure for cryptographic cross-border trade with AI-assisted optimisation, zero counterparty risk, and jurisdiction supremacy."
- **README (260 B):** terse — restates the description.
- **Homepage:** https://sgtx.vercel.app
- **Last pushed:** 2026-09-21.
- **Brain integration domain (§4.1):** `trade.execution`, `trade.governance`, `trade.jurisdiction`. Brain tools could include `sgtx.trade.propose`, `sgtx.trade.execute` (Ed25519 signed), `sgtx.jurisdiction.verify`, `sgtx.audit.fetch`. **Spec §56 (risk gating) is critical here — trades are HIGH risk by default.**
- **Audit notes:** Uses **dual DBs** (libSQL for app + Postgres scripts for production). Ed25519 signatures imply on-chain / non-custodial key custody — Brain must NEVER hold private keys (spec §62 identity isolation rules apply). Test suite (Playwright e2e) is the most complete in the audit — leverages for adapter contract tests.

### 9. MTQ / MITHQAL — `MITHQALMTQ/MTQ`
- **Repo:** https://github.com/MITHQALMTQ/MTQ
- **Status:** public, 5 KB
- **Language:** None
- **Framework:** none — repo contains only `LICENSE` (11,357 B) and `README.md` (183 B).
- **README content (in full):**
  ```
  # MTQ
  MITHQAL adds a neutral settlement capability next to existing banking infrastructure.
  The integration principle is translation, not transformation. Your bank remains your bank.
  ```
- **Homepage:** none
- **Last pushed:** 2026-08-21 (oldest push in the audit).
- **Brain integration domain (§4.1):** `finance.settlement`, `banking.translation` — concept only, no runtime to integrate with.
- **Audit notes:** Stub repository. Concept lives in prose only — no code. **Cannot audit runtime behavior.** Per §186, this platform cannot be claimed as integrated until MTQ has actual code. The operational MITHQAL presence is in `MITHQALMTQ/MTQ_SIGMA` (#14).

### 10. JUDGE-SMART — `fortleem/judge_synapse`
- **Repo:** https://github.com/fortleem/judge_synapse
- **Status:** public, 41.2 MB
- **Language:** HTML
- **Framework:** Next.js + Prisma + shadcn/ui + `@libsql/client` + `next-auth` + `next-intl`. `sync-turso` script (Turso production).
- **Description:** (empty on API). README is in Arabic: "المنصة القضائية الذكية — Egyptian Judicial Smart V2.1".
- **README highlights:** Sovereign platform for judicial AI, legal research, evidence organization, and reasoning support. 5-tab case workspace (Overview / Facts&Evidence / Law / Analysis / Decision). **14 Egyptian government portals indexed** (Constitution, Official Gazette, Cassation, State Council, Supreme Constitutional). 39 authenticated legal texts with full provenance, signed corpus snapshot `EJB-CORPUS-2026.08-R1`. Hybrid search (exact + lexical + temporal). **Strict judge/system separation**: `system_proposal` (non-binding) vs. `judge_decision` (binding) vs. `adversary_transfer` (adversarial review). Audit log "غير [...]" (truncated).
- **Homepage:** https://judge-liart.vercel.app
- **Last pushed:** 2026-09-03 (one of the older repos in active audit).
- **Brain integration domain (§4.1):** `legal.case`, `legal.evidence`, `legal.research`, `legal.decision`. Brain tools could include `judge.case.fetch`, `judge.law.search` (hybrid), `judge.evidence.attach`, `judge.proposal.draft` (non-binding — must respect §165 honest evidence), `judge.corpus.snapshot`. **Directly aligned with WEDJAT §26-33 (knowledge sources/claims/evidence/provenance/versions/conflicts) and §100 (system vs. binding decision separation).**
- **Audit notes:** Second most Brain-aligned repo after VERIFY. The `system_proposal` vs. `judge_decision` distinction maps perfectly to spec §165 (never fake confidence) and §55 (action state machine: PROPOSED is non-binding). Existing signed corpus snapshot pattern (`EJB-CORPUS-2026.08-R1`) is exactly the provenance/versions pattern the Brain models — adapter should reuse judge_synapse's corpus as a knowledge source.

### 11. EGYCOURT — `egycourt/egycourt`
- **Repo:** https://github.com/egycourt/egycourt
- **Status:** **404 Not Found** (confirmed via both API and `https://github.com/egycourt/egycourt`).
- **Org:** `egycourt` (GitHub Organization id 322068454) exists with `public_repos: 0`. **No public repositories at all.**
- **Language:** n/a. **Framework:** n/a. **Description:** n/a.
- **Brain integration domain (§4.1):** unknown — cannot determine without repo access.
- **Audit notes:** Either (a) never existed publicly, (b) was deleted, or (c) is private. **Per spec §186, EGYCOURT cannot be claimed as integrated — no inspection occurred.** Recommend contacting repo owner for clarification before Phase 1.

### 12. SGTX FABLE — `fortleem/SGTX_FABLE`
- **Repo:** https://github.com/fortleem/SGTX_FABLE
- **Status:** public, 1.8 MB
- **Language:** TypeScript
- **Framework:** **README claims Next.js v12 "Sovereign Obsidian & Gold"** app with 9 portals (trader, logistics, financier, QC, lab, gov, admin, marketplace, shipping), 1.5% FeeLock, USTN shipment identity, GTID tenant identity, Loom audit. **However, the actual `package.json` is a 5-dependency Hono + Vite stub** (`hono`, `@hono/vite-build`, `@hono/vite-dev-server`, plus `dev`/`build`/`preview`/`deploy` scripts). The two are inconsistent — the v12 Next.js app described in the README is **not** what's in the current `main` branch's package.json.
- **Description:** (empty on API).
- **README highlights:** Demo credentials provided (`demo123` / `admin123`), 10 demo user emails per portal. Local sandbox URL only (cloud deployment deferred per owner instruction).
- **Homepage:** https://sgtx-fable.vercel.app
- **Last pushed:** 2026-09-20.
- **Brain integration domain (§4.1):** `trade.portal.*` (9 sub-domains: trader, logistics, financier, qc, laboratory, government, admin, marketplace, shipping). Each portal has its own auth gate (`/portal/:id/login` returns 403 for wrong tenant type).
- **Audit notes:** **Significant inconsistency between README and current code.** Either the README is aspirational/legacy or `main` was reset. The 5-dep Hono stub does not match the described 9-portal Next.js app. **Adapter work blocked until reconciliation.** Tenant-type gate pattern (`/portal/:id`) is consistent with WEDJAT §62-63 (tenant isolation) — promising if the code matches the README.

### 13. PPE — `fortleem/PPE`
- **Repo:** https://github.com/fortleem/PPE
- **Status:** public, 14.5 MB
- **Language:** TypeScript
- **Framework:** Next.js + Prisma + shadcn/ui + Tailwind 4 + Zustand + recharts + `z-ai-web-dev-sdk`. PWA installable on Android/iOS.
- **Description:** (empty on API). README is bilingual (EN/AR): "PPE Detector — نظام كشف معدات السلامة".
- **README highlights:** End-to-end PPE (Personal Protective Equipment) compliance detector — classifies workers into Helmet / No Helmet / Safety Vest / No Vest. **Real collected dataset (111 images).** Zero-shot vs. few-shot (8 examples) vs. many-shot (24 examples) experiments. **Automated error-cause analysis** (`label_noise` classification). **Arabic technical report** generator. **Results: 94.7% exact match in all 3 modes**, perfect helmet accuracy, residual vest error labeled `label_noise` (ground-truth issue, not model issue).
- **Homepage:** https://ppe-smart.vercel.app
- **Last pushed:** 2026-09-06.
- **Brain integration domain (§4.1):** `vision.safety.ppe`, `vision.classify`, `vision.dataset`. Brain tools could include `ppe.image.classify`, `ppe.dataset.fetch`, `ppe.report.generate` (Arabic).
- **Audit notes:** Excellent evaluation methodology — matches spec §86-92 (golden dataset evaluation). The 94.7% / `label_noise` finding demonstrates the spec's §163 (honest evidence — UNKNOWN/INSUFFICIENT) philosophy in practice. Should be integrated as a Vision tool under Brain §51-57 governance. Dataset is real and small — ideal for adapter reference tests.

### 14. MTQ SIGMA — `MITHQALMTQ/MTQ_SIGMA`
- **Repo:** https://github.com/MITHQALMTQ/MTQ_SIGMA
- **Status:** public, 59.3 MB
- **Language:** TypeScript
- **Framework:** Next.js + Prisma + shadcn/ui + recharts + `ethers` (Web3) + `socket.io-client` + `@upstash/redis` + `z-ai-web-dev-sdk`. Tests include `test:backtest` (Monte Carlo).
- **Description:** "MTQ Σ is a non-USD, multi-currency reference unit backed by a 110% collateralized reserve of stablecoins and gold, designed to preserve global purchasing power."
- **README highlights:** Closed-loop monetary architecture pilot. GFB Index (5-currency basket), 110% gold-collateralized reserve, mint/redeem priced against the index. **Deployed on 4 testnets** (Monad, Arc, Robinhood, Solana). `src/lib/mtq/` (blueprint engine, Monte Carlo, brand, contract registry), `src/app/api/` (10 endpoints: metrics, oracle, registry, contracts, status, onchain, tests, trials, trials/export, simulate), `src/components/mtq/` (22 UI components), `contracts/` (Solidity: `MtqEcosystem.sol`, `MTQSigma.sol`). **10,300 Monte Carlo runs + 28 on-chain invariant/fuzz tests.**
- **Status (per README):** "Candidate for public testing — NOT production-authorized. Designed for Sharia review (independent fatwa required)."
- **Homepage:** https://mtq-sigma.vercel.app
- **Last pushed:** 2026-09-21.
- **Brain integration domain (§4.1):** `finance.reserve`, `finance.oracle`, `finance.mint_redeem`, `finance.testnet`. Brain tools could include `mtq.oracle.fetch` (GFB Index), `mtq.reserve.status`, `mtq.simulate` (Monte Carlo), `mtq.trial.run`. On-chain actions must be **HIGH risk** under spec §56 — require explicit human approval.
- **Audit notes:** Most mature MITHQAL repo (vs. MTQ stub). Four-testnet deployment + Solidity contracts + Sharia review gate — strongly aligned with spec §60 (data-class ceiling) and §56 (HIGH risk → human approval). Monte Carlo test pattern (10,300 runs) is the heaviest test investment in the audit.

### 15. Wedjat_BrainAI (the Brain repo itself) — `WEDJATAI/Wedjat_BrainAI`
- **Repo:** https://github.com/WEDJATAI/Wedjat_BrainAI
- **Status:** public, 5 KB
- **Language:** None
- **Framework:** none — repo contains **only a `LICENSE` file** (11,357 bytes — matches AGPLv3 typical length).
- **Description:** (empty on API).
- **Homepage:** https://wedjatbrain-ai.vercel.app (deployed but repo content is just LICENSE).
- **Last pushed:** 2026-09-21.
- **Brain integration domain (§4.1):** this IS the Brain.
- **Audit notes:** **The GitHub repo is a placeholder/stub.** The actual WEDJAT BRAIN V2 widget implementation lives in `/home/z/my-project` (the current Next.js workspace) per the local worklog (Task IDs 0–8). This is a known and accepted state — the Brain's source-of-truth code is the local workspace, not the GitHub repo. When the Brain needs to be "published" or referenced by adapters in other platforms, the GitHub repo must be populated first (or the Brain's local code must be packaged/distributed another way). **No external integration blocker** for in-workspace development.

---

## Cross-Platform Findings

### Public vs. private vs. 404
- **Public & inspectable (with substantive content):** 12 of 15
- **Public but stub/placeholder:** 2 (MTQ #9 — LICENSE + 183 B README; Wedjat_BrainAI #15 — LICENSE only)
- **404 / not inspectable:** 1 (EGYCOURT #11 — org exists but `public_repos: 0`)
- **Private (requiring token):** 0 (none — token use was explicitly forbidden by the task and none of the audited repos are private)

### Common frameworks & shared scaffold
A near-identical Next.js + Prisma + shadcn/ui scaffold recurs across 11 of the 12 substantive repos. The shared stack is:

| Concern | Choice | Repos using it |
|---|---|---|
| Framework | Next.js 16 (App Router + Turbopack) | CIRKLE, MAIL, olympex, mashahd, verify, wasl, Aurienta, SGTX, judge_synapse, PPE, MTQ_SIGMA |
| UI | shadcn/ui (New York) + Tailwind 4 | all 11 above |
| DB ORM | Prisma | all 11 above |
| DB runtime | libSQL/SQLite (local) → Turso (production) | CIRKLE, mashahd, verify, wasl, Aurienta, SGTX, judge_synapse, PPE, MTQ_SIGMA |
| DB alt | Drizzle (Neon serverless, edge) | verify |
| DB alt | Postgres (production scripts) | SGTX (`db:push-postgres`) |
| Cache | Upstash Redis | MTQ_SIGMA |
| Auth | next-auth | CIRKLE, Aurienta, SGTX, judge_synapse, PPE, MTQ_SIGMA, wasl, verify |
| i18n | next-intl | CIRKLE, Aurienta, SGTX, judge_synapse, PPE, MTQ_SIGMA, wasl, verify |
| Theming | next-themes | all 11 above |
| Build | Bun (`bun.lock`) + Vercel deploy | all 11 above |
| Dev protocol | `worklog.md` (multi-agent shared log) | CIRKLE (645 KB), mashahd (1.7 MB), Aurienta (1.7 MB), judge_synapse, the local Wedjat workspace itself — **this is the WEDJAT-style multi-agent protocol recurring across the ecosystem** |
| Repo skeleton | `.zscripts/`, `agent-ctx/`, `mini-services/`, `examples/`, `skills/`, `scripts/`, `screenshots/`, `download/`, `Dockerfile`, `Caddyfile` | mashahd, Aurienta, judge_synapse (full set); partial in others |

**Implication for the Brain:** the ecosystem-wide scaffold means a single well-designed adapter pattern (Next.js → `/api/brain/*` proxy or embedded SDK) can be reused across 11 platforms with minimal variation. The Brain adapter layer should be a portable TypeScript package.

### AI provider convergence — and the one outlier
- **`z-ai-web-dev-sdk` is the de-facto AI standard** across the audited ecosystem: 8 of 12 substantive repos use it (MAIL, verify, SGTX, judge_synapse, PPE, olympex_export, MTQ_SIGMA, and the local Wedjat workspace itself).
- **AURIENTA is the only outlier** with `@google/generative-ai`, `@huggingface/inference`, `groq-sdk`, `openai` — four parallel providers, none of which is z-ai.
- **CIRKLE, mashahd, wasl** have no AI SDK declared in their top-level `package.json` (could be in nested workspaces or unused).
- **Implication:** the Brain's model abstraction (spec §45-48) should treat `z-ai-web-dev-sdk` as the canonical adapter (already implemented in the local workspace per worklog Task 1-7) and add a "multi-provider passthrough" adapter for AURIENTA's existing SDK fan-out. Do NOT force AURIENTA to migrate before integration.

### DB convergence
- **Prisma is universal** for app data.
- **Turso (libSQL)** is the production target in nearly every repo with a stated production DB.
- **SGTX** is the only repo with explicit Postgres tooling.
- **verify** uses both Prisma and Drizzle (likely Drizzle for Neon edge reads) — adapters must support both ORMs.
- **MTQ_SIGMA** uniquely adds Upstash Redis (cache) and `ethers` (Web3) — adapter must handle a cache layer + on-chain reads.

### Realtime / Web3 / special stacks
- **Socket.io** in CIRKLE, wasl, MTQ_SIGMA — Brain adapter needs an event-bridge pattern (not just REST).
- **Ed25519 signatures** in SGTX — non-custodial; Brain must never hold keys.
- **Solidity contracts + 4 testnets** in MTQ_SIGMA — on-chain actions are inherently HIGH risk.
- **tesseract.js** in verify — additional OCR engine alongside z-ai VLM.
- **PWA + offline-first** in PPE — installable on mobile without app store.

### Notable patterns
1. **Heavy multi-agent documentation culture:** `worklog.md` files ranging from 645 KB (CIRKLE) to 1.7 MB (mashahd, Aurienta) — every major platform carries a long multi-agent build history. The WEDJAT project's own worklog is part of this same protocol family.
2. **Zero-cost / self-hosted ethos:** `ZERO_COST_ARCHITECTURE.md` (CIRKLE), "zero-cost, self-hosted, privacy-first" (verify), "Zero-cost, sovereign infrastructure" (SGTX) — recurring architectural principle. The Brain's local-only SQLite + in-memory TF-cosine retrieval (per worklog Task 1-7) fits this ethos.
3. **Sovereign / jurisdictional framing:** SGTX ("jurisdiction supremacy"), AURIENTA ("constitutional infrastructure"), MTQ ("neutral settlement"), judge_synapse ("sovereign platform") — the ecosystem is politically sovereignty-themed; Brain governance (§100-105) must respect this.
4. **Arabic-first / Egyptian context:** verify (Arabic OCR, Egyptian National ID), judge_synapse (Arabic UI + Egyptian gov portals), PPE (Arabic technical report), olympex (Egyptian exporter), wasl (Arabic brand "وصل"). Brain i18n (next-intl already present in 8 repos) must include Arabic as a first-class locale.
5. **Audit/provenance culture:** `COO_AUDIT_REPORT.md` (CIRKLE), `REPOSITORY_INTEGRITY.md` (Aurienta), `PRODUCTION_READINESS_AUDIT.md` (multiple), `signed corpus snapshot` (judge_synapse `EJB-CORPUS-2026.08-R1`), Monte Carlo + on-chain invariant tests (MTQ_SIGMA) — the ecosystem already values provenance and audit, which is exactly what the Brain's §127-130 (audit) and §26-33 (provenance) provide.
6. **mashahd ↔ Aurienta identical file sizes** for shared top-level files (`bun.lock` 377,686 B, `worklog.md` 1,724,116 B, etc.) — strongly suggests one was forked from the other or both came from the same template snapshot. A later audit should diff the two `worklog.md` files to confirm.

### Recommended adapter priority order (based on what's actually inspectable)
Ranked by (a) inspectable content depth, (b) Brain-alignment of stated purpose, (c) reuse of canonical stack (Next.js + Prisma + shadcn + z-ai), (d) scope simplicity for first integration:

| Priority | Platform | Rationale |
|---|---|---|
| **P0 (now)** | (15) Wedjat_BrainAI | Local workspace code is fully functional per worklog; not blocked by GitHub stub |
| **P1 (highest external value)** | (5) VERIFY | Brain-aligned (identity/evidence/validity). z-ai. Clean README. Maps to §62, §83-85 |
| **P1** | (10) JUDGE-SMART | Brain-aligned (knowledge/provenance/audit). z-ai. `system_proposal` vs. `judge_decision` matches §165 |
| **P2** | (2) CIRKLE-MAIL | z-ai. Small, well-scoped, high-leverage (email tools) |
| **P2** | (13) PPE | z-ai. Small, real dataset, golden-eval pattern (§86-92) |
| **P3** | (3) OLYMPEX | z-ai. Small. Lower domain leverage (export site) |
| **P3** | (6) WASL | z-ai NOT declared (verify before integration). Socket.io realtime — needs event bridge. "Commit" lifecycle matches §55 |
| **P3** | (8) SGTX | z-ai. Highest security profile (Ed25519, trade execution). Defer until §56 risk gating is field-proven |
| **P3** | (14) MTQ SIGMA | z-ai. Web3 + 4 testnets + Sharia review. Highest domain complexity |
| **P4** | (4) MASHAHD | No README, no z-ai declared. Large + multi-service. Defer until mashahd exposes README |
| **P4** | (1) CIRKLE-SUPERAPP | Hub repo. Has `INTEGRATION.md` and `PHASE0_INSPECTION_REPORT.md` — **read these first** before any adapter |
| **P4** | (7) AURIENTA | **AI-provider divergence** (4 SDKs, no z-ai). Architectural reconciliation needed before adapter |
| **P5 (blocked)** | (12) SGTX FABLE | README ↔ package.json inconsistency. Reconciliation needed before adapter |
| **P5 (blocked)** | (9) MTQ | Stub repo (concept only). No runtime to integrate |
| **P5 (blocked / missing)** | (11) EGYCOURT | 404 / no public repo. Contact owner; cannot claim inspection per §186 |

---

## Honest Limitations

1. **No runtime inspection.** Per the task, this audit was read-only at the GitHub metadata level. No repo was cloned, no code was executed, no deployed site was probed. The "AI hints", "DB hints", and "Framework hints" columns are inferred from `package.json` (top-level only — nested workspace `package.json` files in monorepos like CIRKLE/mashahd were NOT inspected) and README prose. Actual runtime behavior may differ.
2. **Three repos have no README** (CIRKLE, mashahd, Aurienta) and **two are stubs** (MTQ, Wedjat_BrainAI). Their "purpose" is inferred from the GitHub API `description` field and surrounding docs only — runtime capabilities are NOT confirmed.
3. **EGYCOURT (egycourt/egycourt) is genuinely not inspectable.** The org exists but has zero public repos. Per spec §186, **EGYCOURT cannot be claimed as integrated until a public repo appears or the owner grants access**.
4. **Rate limits:** Unauthenticated GitHub API has a 60 req/hour/IP limit. Some calls initially returned HTTP 403 (rate limit) and were retried successfully after brief delays. All final data points in the Summary Table are from successful HTTP 200 responses (or confirmed HTTP 404 for EGYCOURT).
5. **AI provider claims:** the presence of an AI SDK in `package.json` does NOT prove it is used at runtime — it may be a leftover dependency. Conversely, SDKs not declared in the top-level `package.json` may exist in nested workspace packages (especially for monorepos like CIRKLE and mashahd which have many `mini-services` and `skills` directories).
6. **No deployed-site verification.** Each repo lists a Vercel homepage URL — none were probed. Their liveness, version, or feature parity with the repo's `main` branch is unverified.
7. **mashahd ↔ Aurienta identical file sizes** were observed but NOT diffed byte-for-byte; the conclusion that they share a template/fork snapshot is an inference, not a confirmation.
8. **MTQ SIGMA "4 testnets deployed"** claim is from the README only; on-chain contract addresses were not verified.
9. **judge_synapse "14 gov portals indexed"** claim is from the README only; portal liveness was not verified.
10. **The WEDJAT BRAIN V2 widget** itself is documented only via the local `/home/z/my-project/worklog.md` (Task IDs 0–8). The GitHub repo `WEDJATAI/Wedjat_BrainAI` is a LICENSE-only placeholder. Cross-references in this audit treat the local workspace as the source of truth for the Brain.
