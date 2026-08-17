import { SupportTicketBoard } from "@/components/support-ticket-board";
import { supportRuns, supportTickets } from "@/lib/db/admin";
import { requireManager } from "@/lib/auth";

export default async function AdminSupportPage() {
  await requireManager();
  const [runs, tickets] = await Promise.all([supportRuns(), supportTickets()]);
  return <><header className="admin-page-header"><div><span>SUPPORT OPERATIONS</span><h1>상담 관제</h1><p>상담 도구 실행과 사람에게 이관된 문의를 함께 추적합니다.</p></div><b>{tickets.filter((ticket) => ticket.status !== "RESOLVED").length} ACTIVE TICKETS</b></header><main className="admin-page-body support-admin-body">
    <section><div className="admin-section-title"><div><span>HUMAN HANDOFF</span><h2>문의 티켓</h2></div><small>{tickets.length} TICKETS</small></div><SupportTicketBoard initialTickets={tickets} /></section>
    <section><div className="admin-section-title"><div><span>AGENT OBSERVABILITY</span><h2>상담 실행 기록</h2></div><small>{runs.length} RUNS</small></div><div className="admin-data-panel"><div className="support-run-head"><span>질문</span><span>모델</span><span>지연</span><span>토큰</span><span>상태</span></div>{runs.length === 0 && <div className="admin-empty">아직 상담 실행 기록이 없습니다.</div>}{runs.map((run) => <div className="support-run-row" key={run.id}><strong>{run.last_user_message ?? "질문 없음"}</strong><span>{run.model_provider} · {run.model_name}</span><span>{run.latency_ms ?? 0}ms</span><span>{(run.input_tokens ?? 0) + (run.output_tokens ?? 0)}</span><b className={`status-badge ${run.status === "COMPLETED" ? "ready" : "failed"}`}>{run.status}</b>{run.error_message && <small>{run.error_message}</small>}</div>)}</div></section>
  </main></>;
}
