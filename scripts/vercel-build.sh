#!/usr/bin/env bash
# scripts/vercel-build.sh — Vercel build wrapper
#
# Problem: schema.prisma uses `provider = "sqlite"` for local dev (fast, no
# Postgres needed). Vercel production needs `provider = "postgresql"` to
# connect to Neon.
#
# Solution: this script swaps the provider to postgresql before `prisma
# generate` runs, so the generated Prisma Client targets Postgres. The
# schema.prisma file in git stays as sqlite (for local dev), but the Vercel
# build uses postgresql.
#
# Set as the Vercel "buildCommand" in vercel.json:
#   "buildCommand": "bash scripts/vercel-build.sh"
set -euo pipefail

SCHEMA="prisma/schema.prisma"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL env var not set" >&2
  exit 1
fi

# Detect if DATABASE_URL is a Postgres URL
if [[ "${DATABASE_URL}" == postgres://* ]] || [[ "${DATABASE_URL}" == postgresql://* ]]; then
  echo "[vercel-build] DATABASE_URL is Postgres — swapping schema provider to postgresql"
  sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
  rm -f "$SCHEMA.bak"
else
  echo "[vercel-build] DATABASE_URL is not Postgres (got: ${DATABASE_URL:0:20}...) — keeping sqlite"
fi

echo "[vercel-build] running prisma generate"
bun run db:generate

echo "[vercel-build] running next build"
bun run build

echo "[vercel-build] done"
