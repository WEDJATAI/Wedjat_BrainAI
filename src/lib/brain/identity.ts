// WEDJAT BRAIN V2 — Identity resolution (§16) + tenant isolation (§62, §63).
//
// The Brain must know WHO is asking, FROM WHICH APPLICATION, UNDER WHICH
// TENANT, WITH WHICH PERMISSIONS, IN WHICH SESSION (§16). Tenant isolation is
// mandatory (Rule 5). Cross-tenant retrieval must fail safely (§63).

import { db } from "@/lib/db";
import type { BrainRequest, IdentityContext, DataClassification, PolicyMode } from "./types";

export class IdentityError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "IdentityError";
  }
}

/** Resolve the full identity context from a BrainRequest. Enforces tenant isolation. */
export async function resolveIdentity(req: BrainRequest): Promise<IdentityContext> {
  if (!req.tenantId) throw new IdentityError("TENANT_REQUIRED", "tenantId is required");
  if (!req.applicationId) throw new IdentityError("APPLICATION_REQUIRED", "applicationId is required");

  const tenant = await db.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant) throw new IdentityError("TENANT_NOT_FOUND", `tenant ${req.tenantId} not found`);
  if (tenant.status !== "ACTIVE") {
    throw new IdentityError("TENANT_INACTIVE", `tenant ${tenant.slug} is ${tenant.status}`);
  }

  const application = await db.application.findUnique({ where: { id: req.applicationId } });
  if (!application) throw new IdentityError("APP_NOT_FOUND", `application ${req.applicationId} not found`);
  if (application.tenantId !== tenant.id) {
    // §63 cross-tenant attack — must fail safely.
    throw new IdentityError(
      "TENANT_BOUNDARY_VIOLATION",
      `application ${application.slug} does not belong to tenant ${tenant.slug}`,
    );
  }
  if (application.status !== "ACTIVE") {
    throw new IdentityError("APP_INACTIVE", `application ${application.slug} is ${application.status}`);
  }

  let user: IdentityContext["user"];
  if (req.userId) {
    const u = await db.user.findUnique({ where: { id: req.userId } });
    if (!u) throw new IdentityError("USER_NOT_FOUND", `user ${req.userId} not found`);
    if (u.tenantId !== tenant.id) {
      throw new IdentityError("USER_TENANT_MISMATCH", `user does not belong to tenant ${tenant.slug}`);
    }
    user = {
      id: u.id,
      email: u.email,
      name: u.name ?? undefined,
      scopes: u.scopes ? u.scopes.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
  }

  let session: IdentityContext["session"];
  if (req.sessionId) {
    const s = await db.session.findUnique({ where: { id: req.sessionId } });
    if (s) {
      if (s.tenantId !== tenant.id || s.applicationId !== application.id) {
        throw new IdentityError("SESSION_SCOPE_VIOLATION", "session does not match tenant/application");
      }
      session = { id: s.id, externalRef: s.externalRef ?? undefined };
    }
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      dataPolicy: tenant.dataPolicy as DataClassification,
    },
    application: {
      id: application.id,
      name: application.name,
      slug: application.slug,
      knowledgeScope: application.knowledgeScope,
      memoryScope: application.memoryScope,
      toolScope: application.toolScope,
      policyScope: application.policyScope,
      modelPolicy: application.modelPolicy as PolicyMode,
    },
    user,
    session,
  };
}

/** Verify a scope is present in the identity's permissions (§14, §61). */
export function hasScope(identity: IdentityContext, scope: string): boolean {
  if (!identity.user) return false;
  if (identity.user.scopes.includes("brain:admin")) return true;
  return identity.user.scopes.includes(scope);
}
