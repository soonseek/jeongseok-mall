"use client";

import { useState } from "react";
import type { AdminOrderRow } from "@/lib/db/admin";
import { createClientId } from "@/lib/client-id";
import { formatWon } from "@/lib/format";

export function OrderAdminTable({ initial }: { initial: AdminOrderRow[] }) {
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string>();
  const [message, setMessage] = useState("");

  async function cancel(order: AdminOrderRow) {
    const reason = window.prompt("테스트 결제 취소 사유를 입력하세요.", "고객 요청");
    if (!reason) return;
    setPendingId(order.id); setMessage("");
    const response = await fetch(`/api/admin/orders/${order.id}/cancel`, { method: "POST", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify({ reason, idempotencyKey: createClientId() }) });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? "취소하지 못했습니다.");
    else { setItems((current) => current.map((item) => item.id === order.id ? { ...item, status: "CANCELED", payment_status: "CANCELED" } : item)); setMessage("테스트 결제를 전액 취소했습니다."); }
    setPendingId(undefined);
  }

  return <section className="admin-data-panel">
    <div className="admin-table-head order"><span>주문</span><span>고객</span><span>금액</span><span>결제</span><span>주문 상태</span><span /></div>
    {items.length === 0 && <div className="admin-empty">아직 생성된 주문이 없습니다.</div>}
    {items.map((item) => <div key={item.id} className="admin-order-row"><div><strong>{item.order_number}</strong><small>{new Date(item.created_at).toLocaleString("ko-KR")}</small></div><div><strong>{item.customer_name}</strong><small>{item.email}</small></div><strong>{formatWon(item.total_amount)}</strong><span>{item.method ?? item.payment_status ?? "-"}</span><b className={`status-badge ${item.status === "PAID" ? "ready" : item.status.includes("FAILED") ? "failed" : "unverified"}`}>{item.status}</b>{item.status === "PAID" ? <button disabled={pendingId === item.id} onClick={() => cancel(item)}>전액 취소</button> : <span />}</div>)}
    {message && <div className="admin-toast">{message}</div>}
  </section>;
}
