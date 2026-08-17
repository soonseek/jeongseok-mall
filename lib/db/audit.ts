import { randomUUID } from "node:crypto";
import { execute } from "@/lib/db/client";

export async function writeAuditLog(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary?: Record<string, unknown>;
  requestId?: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO audit_logs(id, actor_id, action, entity_type, entity_id, summary, request_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [randomUUID(), input.actorId, input.action, input.entityType, input.entityId, JSON.stringify(input.summary ?? {}), input.requestId ?? null],
  );
}
