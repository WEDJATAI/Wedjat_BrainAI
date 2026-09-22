# WEDJAT BRAIN — SECURITY NOTICE (spec §60-61, §172-174)

> **⚠️ ROTATION REQUIRED BEFORE ANY PRODUCTION USE**

## What happened

During the conversation that initiated this implementation, the following
credentials were transmitted in plain text through the IM channel:

- GitHub personal access token (Wedjat_BrainAI repo)
- Vercel deployment token
- Neon Postgres connection string (with password)
- Turso auth token
- Inngest event key
- Neon REST API base

Per **WEDJAT BRAIN V2 spec §61 ("Security Rotation Requirement")**:

> Because credentials were provided in this conversation: Before production
> integration, rotate all exposed credentials. The implementation must not
> reuse exposed credential strings.

## What this implementation does

1. **All credentials live in `.env`** — which is in `.gitignore` (`*.env*`).
   They are never committed, never printed, never stored in Brain memory,
   embeddings, prompts, or audit content.
2. **Code references `process.env.X`** exclusively — no hardcoded secrets.
3. **`.env.example`** ships placeholder values for new environments.
4. **Secret scanning** is recommended (spec §173) — enable GitHub push
   protection + a pre-commit hook (e.g. `gitleaks`) before merging.

## What you must do before production

1. **Rotate every exposed credential** (GitHub, Vercel, Neon, Turso, Inngest).
2. Store the rotated values in a real secret manager (Vercel project env,
   Doppler, AWS Secrets Manager, etc.) — not in `.env` files on servers.
3. Use **least-privilege** credentials per spec §174:
   - separate dev / preview / production credentials
   - separate credentials per application adapter (§92-93)
   - never reuse one universal credential across every platform
4. Enable **secret scanning / push protection** on the GitHub repo (§173).
5. Audit **git history** for accidental secret commits (§172):
   ```bash
   git log --all --source -S "ghp_" --since="6 months ago"
   git log --all --source -S "npg_" --since="6 months ago"
   ```
   If found, rewrite history + force-push + invalidate the leaked tokens.
6. Add a pre-commit hook:
   ```bash
   # .gitleaks.toml + .husky/pre-commit running `gitleaks protect --staged`
   ```

## Trust boundary reminder (spec §58)

The Brain treats **all retrieved content, tool output, and user input as
untrusted** (Rule 4). Credentials are never exposed to the model, never
embedded in prompts, and never logged in audit events. The policy layer
(spec §100) enforces this in code, not merely in prompts.
