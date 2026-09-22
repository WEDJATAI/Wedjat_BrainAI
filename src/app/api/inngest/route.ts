// /api/inngest — Inngest serve handler (spec §65).
//
// This is the single endpoint the Inngest worker uses to:
//   - GET  — introspection / "are you up?" probe.
//   - POST — event dispatch (Inngest delivers events + triggers functions).
//   - PUT  — sync (Inngest pulls the registered function definitions).
//
// In production this route is hit by the Inngest cloud (or self-hosted
// worker). In dev, use `inngest-cli dev` pointed at http://localhost:3000/api/inngest
// OR use POST /api/brain/jobs to invoke Brain functions directly without a
// running Inngest worker.

import { serve } from "inngest/next";
import { inngest, brainFunctions } from "@/lib/brain/inngest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `streaming: true` lets long-running functions (e.g. brain-human-approval-wait)
// stream partial state back to Inngest without hitting the platform's request
// timeout. The JS SDK uses `true` (the `"allow"` string is the Python SDK
// convention; the type here is `true | false`).
const handler = serve({
  client: inngest,
  functions: brainFunctions,
  streaming: true,
});

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
