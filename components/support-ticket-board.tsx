"use client";

import { useState } from "react";
import type { SupportTicketRow } from "@/lib/db/admin";

const statuses: SupportTicketRow["status"][] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

export function SupportTicketBoard({ initialTickets }: { initialTickets: SupportTicketRow[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  async function updateStatus(ticket: SupportTicketRow, status: SupportTicketRow["status"]) {
    setPending(ticket.id); setMessage("");
    const response = await fetch(`/api/admin/support/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-jeongseok-request": "1" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();
    if (response.ok) {
      setTickets((current) => current.map((item) => item.id === ticket.id ? result.ticket : item));
      setMessage("문의 상태를 변경했습니다.");
    } else setMessage(result.error ?? "문의 상태를 변경하지 못했습니다.");
    setPending("");
  }

  return <div className="admin-data-panel">
    <div className="support-ticket-head"><span>고객·제목</span><span>문의 요약</span><span>접수 시각</span><span>처리 상태</span></div>
    {tickets.length === 0 && <div className="admin-empty">사람 상담으로 이관된 문의가 없습니다.</div>}
    {tickets.map((ticket) => <article className="support-ticket-row" key={ticket.id}>
      <div><strong>{ticket.subject}</strong><small>{ticket.customer_name ?? "비회원"} · {ticket.customer_email ?? "식별 정보 없음"}</small></div>
      <p>{ticket.summary}</p>
      <time>{new Date(ticket.created_at).toLocaleString("ko-KR")}</time>
      <select disabled={pending === ticket.id} value={ticket.status} onChange={(event) => updateStatus(ticket, event.target.value as SupportTicketRow["status"])}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
    </article>)}
    {message && <div className="admin-toast" role="status">{message}</div>}
  </div>;
}
