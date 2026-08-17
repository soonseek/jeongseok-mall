"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAuthForm({ mode }: { mode: "setup" | "login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const response = await fetch(`/api/admin/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-jeongseok-request": "1" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "처리하지 못했습니다.");
      setPending(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return <form className="admin-auth-form" onSubmit={submit}>
    {mode === "setup" && <label><span>관리자 이름</span><input name="name" required autoComplete="name" placeholder="양실장" /></label>}
    <label><span>이메일</span><input name="email" type="email" required autoComplete="email" placeholder="admin@example.com" /></label>
    <label><span>비밀번호</span><input name="password" type="password" required minLength={mode === "setup" ? 12 : 1} autoComplete={mode === "setup" ? "new-password" : "current-password"} /></label>
    {mode === "setup" && <small>12자 이상, 영문과 숫자를 함께 사용합니다.</small>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="admin-primary-button" disabled={pending}>{pending ? "처리 중…" : mode === "setup" ? "관리자 설정 완료" : "로그인"}</button>
  </form>;
}
