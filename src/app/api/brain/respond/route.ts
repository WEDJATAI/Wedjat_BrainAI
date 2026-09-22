// POST /api/brain/respond — streaming Brain response (§13).
//
// Streams BrainStreamEvent objects as newline-delimited JSON. The final event
// is `{ type: "done", response: BrainResponse }`.
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { runBrain } from "@/lib/brain/runtime";
import { seedBrain } from "@/lib/brain/seed";
import { db } from "@/lib/db";
import type { BrainRequest, BrainStreamEvent } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureSeed() {
  const tenantCount = await db.tenant.count();
  if (tenantCount === 0) {
    await seedBrain();
  }
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const body = (await req.json()) as Partial<BrainRequest>;
  const requestId = body.requestId || randomUUID();

  // Resolve tenant/application/user defaults so the widget works out-of-box.
  // Real deployments would require explicit tenant headers + auth.
  const tenant = await resolveDefaultTenant();
  const application = await resolveDefaultApplication(tenant.id);
  const user = await resolveDefaultUser(tenant.id);

  // Ensure conversation exists for episodic recording.
  let conversationId = body.conversationId;
  if (!conversationId) {
    const conv = await db.conversation.create({
      data: {
        tenantId: tenant.id,
        applicationId: application.id,
        sessionId: (await db.session.create({ data: { tenantId: tenant.id, applicationId: application.id, userId: user?.id, externalRef: body.sessionId } })).id,
        userId: user?.id,
        title: (body.input?.text ?? "Brain conversation").slice(0, 80),
      },
    });
    conversationId = conv.id;
  }

  const brainReq: BrainRequest = {
    requestId,
    tenantId: tenant.id,
    applicationId: application.id,
    userId: user?.id,
    sessionId: body.sessionId,
    conversationId,
    input: { text: body.input?.text ?? "" },
    mode: body.mode ?? "auto",
    permissions: { scopes: user?.scopes?.split(",") ?? ["brain:respond"] },
    constraints: body.constraints,
    metadata: body.metadata,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (ev: BrainStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      };
      try {
        await runBrain(brainReq, { onEvent: send });
      } catch (err: any) {
        send({ type: "error", message: err?.message ?? "brain failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

async function resolveDefaultTenant() {
  let t = await db.tenant.findUnique({ where: { slug: "acme" } });
  if (!t) {
    await seedBrain();
    t = await db.tenant.findUnique({ where: { slug: "acme" } });
  }
  return t!;
}

async function resolveDefaultApplication(tenantId: string) {
  const a = await db.application.findFirst({ where: { tenantId, slug: "mashahd" } });
  return a!;
}

async function resolveDefaultUser(tenantId: string) {
  const u = await db.user.findFirst({ where: { tenantId, email: "alice@acme.test" } });
  return u;
}
