import { randomUUID } from "node:crypto";
import { execute, query } from "@/lib/db/client";

export type ChatMessage = { role: "USER" | "ASSISTANT"; content: string };

export async function getOrCreateConversation(input: { conversationId?: string; sessionKey: string }): Promise<string> {
  if (input.conversationId) {
    const rows = await query<{ id: string }>("SELECT id FROM conversations WHERE id=$1 AND session_key=$2 AND status='OPEN'", [input.conversationId, input.sessionKey]);
    if (rows[0]) return rows[0].id;
  }
  const id = randomUUID();
  await execute("INSERT INTO conversations(id, session_key) VALUES ($1,$2)", [id, input.sessionKey]);
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

export async function recordAgentTool(runId: string, argumentsValue: Record<string, unknown>, resultSummary: Record<string, unknown>): Promise<void> {
  await execute(
    `INSERT INTO agent_tool_calls(id, agent_run_id, tool_name, arguments, result_summary, status)
     VALUES ($1,$2,'search_catalog',$3::jsonb,$4::jsonb,'COMPLETED')`,
    [randomUUID(), runId, JSON.stringify(argumentsValue), JSON.stringify(resultSummary)],
  );
}

export async function finishAgentRun(runId: string, input: { status: "COMPLETED" | "FAILED"; inputTokens?: number; outputTokens?: number; errorMessage?: string; latencyMs: number }): Promise<void> {
  await execute(
    `UPDATE agent_runs SET status=$2, input_tokens=$3, output_tokens=$4, error_message=$5,
       latency_ms=$6, completed_at=now() WHERE id=$1`,
    [runId, input.status, input.inputTokens ?? null, input.outputTokens ?? null, input.errorMessage ?? null, input.latencyMs],
  );
}
