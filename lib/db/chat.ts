import { randomUUID } from "node:crypto";
import { execute, query } from "@/lib/db/client";

export type ChatMessage = { role: "USER" | "ASSISTANT"; content: string };

export async function getOrCreateConversation(input: { conversationId?: string; sessionKey: string; userId?: string }): Promise<string> {
  if (input.conversationId) {
    const rows = await query<{ id: string }>(
      "SELECT id FROM conversations WHERE id=$1 AND session_key=$2 AND user_id IS NOT DISTINCT FROM $3 AND status='OPEN'",
      [input.conversationId, input.sessionKey, input.userId ?? null],
    );
    if (rows[0]) return rows[0].id;
  }
  const id = randomUUID();
  await execute("INSERT INTO conversations(id, user_id, session_key) VALUES ($1,$2,$3)", [id, input.userId ?? null, input.sessionKey]);
  return id;
}

export async function saveMessage(conversationId: string, role: "USER" | "ASSISTANT", content: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await execute(
    "INSERT INTO messages(id, conversation_id, role, content, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [randomUUID(), conversationId, role, content, JSON.stringify(metadata)],
  );
  await execute("UPDATE conversations SET updated_at=now() WHERE id=$1", [conversationId]);
}

export async function recentMessages(conversationId: string): Promise<ChatMessage[]> {
  return query<ChatMessage>(
    `SELECT role, content FROM (
       SELECT role, content, created_at FROM messages
       WHERE conversation_id=$1 AND role IN ('USER','ASSISTANT')
       ORDER BY created_at DESC LIMIT 10
     ) recent ORDER BY created_at`,
    [conversationId],
  );
}

export async function startAgentRun(conversationId: string, modelProvider: string, modelName: string): Promise<string> {
  const id = randomUUID();
  await execute(
    `INSERT INTO agent_runs(id, conversation_id, model_provider, model_name, status)
     VALUES ($1,$2,$3,$4,'RUNNING')`,
    [id, conversationId, modelProvider, modelName],
  );
  return id;
}

export async function recordAgentTool(runId: string, toolName: string, argumentsValue: Record<string, unknown>, resultSummary: Record<string, unknown>): Promise<void> {
  await execute(
    `INSERT INTO agent_tool_calls(id, agent_run_id, tool_name, arguments, result_summary, status)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,'COMPLETED')`,
    [randomUUID(), runId, toolName, JSON.stringify(argumentsValue), JSON.stringify(resultSummary)],
  );
}

export type OwnOrderStatus = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_status: string | null;
  created_at: string;
};

export async function getOwnOrderStatus(userId: string, orderNumber?: string): Promise<OwnOrderStatus | null> {
  const params: unknown[] = [userId];
  const orderClause = orderNumber ? "AND o.order_number=$2" : "";
  if (orderNumber) params.push(orderNumber);
  const rows = await query<OwnOrderStatus>(
    `SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
            p.status AS payment_status
     FROM orders o LEFT JOIN LATERAL (
       SELECT status FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1
     ) p ON true
     WHERE o.user_id=$1 ${orderClause}
     ORDER BY o.created_at DESC LIMIT 1`,
    params,
  );
  return rows[0] ? { ...rows[0], total_amount: Number(rows[0].total_amount) } : null;
}

export async function createSupportTicket(input: { conversationId: string; userId?: string; subject: string; summary: string }): Promise<string> {
  const id = randomUUID();
  await execute(
    "INSERT INTO support_tickets(id, conversation_id, user_id, subject, summary) VALUES ($1,$2,$3,$4,$5)",
    [id, input.conversationId, input.userId ?? null, input.subject, input.summary],
  );
  await execute("UPDATE conversations SET status='HANDED_OFF', updated_at=now() WHERE id=$1", [input.conversationId]);
  return id;
}

export async function finishAgentRun(runId: string, input: { status: "COMPLETED" | "FAILED"; inputTokens?: number; outputTokens?: number; errorMessage?: string; latencyMs: number }): Promise<void> {
  await execute(
    `UPDATE agent_runs SET status=$2, input_tokens=$3, output_tokens=$4, error_message=$5,
       latency_ms=$6, completed_at=now() WHERE id=$1`,
    [runId, input.status, input.inputTokens ?? null, input.outputTokens ?? null, input.errorMessage ?? null, input.latencyMs],
  );
}
