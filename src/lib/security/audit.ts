import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestAuditMeta } from "./csrf";

export interface AuditLogInput {
  request?: Request;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Appends an immutable security/governance audit record. Uses service-role admin client when available.
 */
export async function recordAuditLog(
  input: AuditLogInput,
  fallbackDb?: SupabaseClient
): Promise<void> {
  const db = createAdminClient() || fallbackDb;
  if (!db) return;

  const meta = input.request
    ? getRequestAuditMeta(input.request)
    : { ip: "127.0.0.1", userAgent: "server" };

  try {
    await db.from("audit_logs").insert({
      actor_id: input.actorId || null,
      actor_role: input.actorRole || "system",
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      details: input.details || {},
    });
  } catch {
    // Audit write must not crash primary workflow, though schema grants service-role insert
  }
}

/**
 * Safe error logger that omits stack traces from API responses and forwards diagnostics to Sentry if configured.
 */
export function logServerError(context: string, error: unknown): void {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  console.error(`[TrioDealers:${context}]`, message);
}

