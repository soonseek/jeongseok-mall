"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_CUSTOMER } from "@/lib/demo";

export function CustomerLoginForm({ redirectTo = "/account" }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-jeongseok-request": "1" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "로그인하지 못했습니다.");
      setPending(false);
      return;
    }
    router.push(redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/account");
    router.refresh();
  }

  return <form className="customer-login-form" onSubmit={submit}>
    <label><span>이메일</span><input name="email" type="email" required defaultValue={DEMO_CUSTOMER.email} autoComplete="email" /></label>
    <label><span>비밀번호</span><input name="password" type="password" required defaultValue={DEMO_CUSTOMER.password} autoComplete="current-password" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "로그인 중…" : "데모 계정으로 로그인"}</button>
    <small>가상 고객 데이터만 사용하는 공개 테스트 계정입니다.</small>
  </form>;
}

export function CustomerLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return <button className="account-logout" disabled={pending} onClick={async () => {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST", headers: { "x-jeongseok-request": "1" } });
    router.refresh();
  }}>{pending ? "로그아웃 중…" : "로그아웃"}</button>;
}
