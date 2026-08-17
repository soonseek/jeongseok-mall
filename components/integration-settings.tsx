"use client";

import { FormEvent, useState } from "react";
import type { IntegrationSummary } from "@/lib/db/integrations";

type Kind = "TOSS_PAYMENTS" | "AI_MODEL" | "TTS";

const definitions: Array<{ kind: Kind; title: string; description: string }> = [
  { kind: "TOSS_PAYMENTS", title: "토스페이먼츠", description: "결제창 호출에는 클라이언트 키, 서버 승인에는 시크릿 키를 사용합니다." },
  { kind: "AI_MODEL", title: "상담·콘텐츠 AI", description: "상품 상담과 상세페이지 초안을 만드는 모델입니다." },
  { kind: "TTS", title: "쇼츠 음성", description: "상품 소개 쇼츠의 음성을 생성합니다." },
];

export function IntegrationSettings({ initial, canEdit }: { initial: IntegrationSummary[]; canEdit: boolean }) {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);

  async function save(event: FormEvent<HTMLFormElement>, kind: Kind) {
    event.preventDefault();
    if (!canEdit) return;
    setPendingKind(kind);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const environment = String(form.get("environment") ?? "TEST") as "TEST" | "LIVE";
    const base = {
      kind,
      provider: kind === "TOSS_PAYMENTS" ? "TOSS_PAYMENTS" : "OPENAI",
      label: kind === "TOSS_PAYMENTS" ? "토스페이먼츠 결제" : kind === "AI_MODEL" ? "OpenAI 상담·콘텐츠" : "OpenAI 쇼츠 음성",
      environment,
      secret: String(form.get("secret") ?? "") || undefined,
    };
    const body = kind === "TOSS_PAYMENTS"
      ? { ...base, settings: { clientKey: String(form.get("clientKey") ?? "") } }
      : kind === "AI_MODEL"
        ? { ...base, settings: { model: String(form.get("model") ?? "gpt-5.6") } }
        : { ...base, settings: { model: String(form.get("model") ?? "gpt-4o-mini-tts"), voice: String(form.get("voice") ?? "coral") } };
    const response = await fetch("/api/admin/integrations", { method: "PUT", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? "저장하지 못했습니다.");
    else {
      setItems((current) => [...current.filter((item) => !(item.kind === kind && item.environment === environment)), result.integration]);
      event.currentTarget.reset();
      setMessage(`${definitions.find((item) => item.kind === kind)?.title} 설정을 암호화해 저장했습니다.`);
    }
    setPendingKind(null);
  }

  return <div className="integration-grid">
    {definitions.map((definition) => {
      const saved = items.find((item) => item.kind === definition.kind && item.environment === "TEST");
      return <article className="integration-card" key={definition.kind}>
        <header><div><span>{definition.kind}</span><h2>{definition.title}</h2></div><b className={`status-badge ${saved?.status.toLowerCase() ?? "unconfigured"}`}>{saved ? saved.status : "미설정"}</b></header>
        <p>{definition.description}</p>
        <form className="admin-form" onSubmit={(event) => save(event, definition.kind)}>
          <input type="hidden" name="environment" value="TEST" />
          {definition.kind === "TOSS_PAYMENTS" && <label><span>클라이언트 키</span><input name="clientKey" defaultValue={String(saved?.settings.clientKey ?? "")} required disabled={!canEdit} placeholder="test_ck_..." autoComplete="off" /></label>}
          {definition.kind === "AI_MODEL" && <label><span>모델</span><input name="model" defaultValue={String(saved?.settings.model ?? "gpt-5.6")} required disabled={!canEdit} /></label>}
          {definition.kind === "TTS" && <><label><span>모델</span><input name="model" defaultValue={String(saved?.settings.model ?? "gpt-4o-mini-tts")} required disabled={!canEdit} /></label><label><span>목소리</span><input name="voice" defaultValue={String(saved?.settings.voice ?? "coral")} required disabled={!canEdit} /></label></>}
          <label><span>{definition.kind === "TOSS_PAYMENTS" ? "시크릿 키" : "API 키"}</span><input name="secret" type="password" disabled={!canEdit} placeholder={saved?.key_suffix ? `저장됨 ····${saved.key_suffix} (바꿀 때만 입력)` : "키 입력"} autoComplete="new-password" /></label>
          <button className="admin-primary-button" disabled={!canEdit || pendingKind === definition.kind}>{pendingKind === definition.kind ? "암호화 저장 중…" : "설정 저장"}</button>
        </form>
      </article>;
    })}
    {message && <div className="admin-toast" role="status">{message}</div>}
  </div>;
}
