"use client";

import { FormEvent, useState } from "react";
import type { StaffUser } from "@/lib/db/auth";

export function StaffUserManager({ initial }: { initial: StaffUser[] }) {
  const [users, setUsers] = useState(initial);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending("create"); setMessage("");
    const form = event.currentTarget;
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const result = await response.json();
    if (response.ok) { setUsers((current) => [...current, result.user]); form.reset(); setMessage("담당자 계정을 만들었습니다."); }
    else setMessage(result.error ?? "담당자를 만들지 못했습니다.");
    setPending("");
  }

  async function update(user: StaffUser, role: "CONTENT_EDITOR" | "ADMIN", status: "ACTIVE" | "DISABLED") {
    setPending(user.id); setMessage("");
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify({ id: user.id, role, status }) });
    const result = await response.json();
    if (response.ok) { setUsers((current) => current.map((item) => item.id === user.id ? result.user : item)); setMessage("담당자 권한을 변경했습니다."); }
    else setMessage(result.error ?? "권한을 변경하지 못했습니다.");
    setPending("");
  }

  return <div className="staff-manager"><form className="staff-create-form" onSubmit={create}><label><span>이름</span><input name="name" required /></label><label><span>이메일</span><input name="email" type="email" required /></label><label><span>초기 비밀번호</span><input name="password" type="password" minLength={12} required /></label><label><span>역할</span><select name="role"><option value="CONTENT_EDITOR">콘텐츠 담당자</option><option value="ADMIN">관리자</option></select></label><button className="admin-primary-button" disabled={Boolean(pending)}>담당자 추가</button></form>
    <section className="admin-data-panel"><div className="staff-head"><span>담당자</span><span>역할</span><span>상태</span><span>등록일</span></div>{users.map((user) => <article className="staff-row" key={user.id}><div><strong>{user.name}</strong><small>{user.email}</small></div>{user.role === "SUPER_ADMIN" ? <b>SUPER_ADMIN</b> : <select disabled={pending === user.id} value={user.role} onChange={(event) => update(user, event.target.value as "CONTENT_EDITOR" | "ADMIN", user.status)}><option value="CONTENT_EDITOR">CONTENT_EDITOR</option><option value="ADMIN">ADMIN</option></select>}{user.role === "SUPER_ADMIN" ? <b className="status-badge ready">ACTIVE</b> : <select disabled={pending === user.id} value={user.status} onChange={(event) => update(user, user.role as "CONTENT_EDITOR" | "ADMIN", event.target.value as "ACTIVE" | "DISABLED")}><option>ACTIVE</option><option>DISABLED</option></select>}<time>{new Date(user.created_at).toLocaleDateString("ko-KR")}</time></article>)}</section>
    {message && <div className="admin-toast" role="status">{message}</div>}
  </div>;
}
