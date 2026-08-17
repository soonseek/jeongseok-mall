import { supportRuns } from "@/lib/db/admin";

export default async function AdminSupportPage() {
  const runs = await supportRuns();
  return <><header className="admin-page-header"><div><span>AGENT OBSERVABILITY</span><h1>상담 관제</h1><p>고객 질문마다 어떤 모델과 상품 검색이 실행됐는지 확인합니다.</p></div><b>{runs.length} RUNS</b></header><main className="admin-page-body"><section className="admin-data-panel"><div className="support-run-head"><span>질문</span><span>모델</span><span>지연</span><span>토큰</span><span>상태</span></div>{runs.length === 0 && <div className="admin-empty">아직 상담 실행 기록이 없습니다.</div>}{runs.map((run) => <div className="support-run-row" key={run.id}><strong>{run.last_user_message ?? "질문 없음"}</strong><span>{run.model_provider} · {run.model_name}</span><span>{run.latency_ms ?? 0}ms</span><span>{(run.input_tokens ?? 0) + (run.output_tokens ?? 0)}</span><b className={`status-badge ${run.status === "COMPLETED" ? "ready" : "failed"}`}>{run.status}</b>{run.error_message && <small>{run.error_message}</small>}</div>)}</section></main></>;
}
