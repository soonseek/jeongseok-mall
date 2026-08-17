"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ArrowIcon, SparkIcon } from "@/components/icons";
import { createClientId } from "@/lib/client-id";

type ChatTurn = { role: "user" | "assistant"; content: string; products?: Array<{ id: string; slug: string; name: string; price: number }> };

export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [turns, setTurns] = useState<ChatTurn[]>([
    { role: "assistant", content: "어떤 환경을 바꾸고 싶은지 알려주세요. 예산까지 말씀해주시면 현재 판매 중인 상품 안에서 직접 찾아볼게요." },
  ]);
  const sessionKey = useMemo(() => createClientId(), []);

  async function ask(message: string) {
    const clean = message.trim();
    if (!clean || pending) return;
    setTurns((current) => [...current, { role: "user", content: clean }]);
    setPending(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify({ message: clean, conversationId, sessionKey }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setConversationId(result.conversationId);
      setTurns((current) => [...current, { role: "assistant", content: result.answer, products: result.products }]);
    } catch (error) {
      setTurns((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "답변을 만들지 못했습니다." }]);
    } finally { setPending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form).get("message");
    form.reset();
    void ask(String(input ?? ""));
  }

  return <>
    <button className="chat-launcher" onClick={() => setOpen(true)}><SparkIcon /><span><strong>정석 상담</strong><small>상품 고르기부터 주문까지</small></span></button>
    {open && <div className="chat-drawer" role="dialog" aria-modal="true" aria-label="정석 상담">
      <header><div><span className="status-dot" /><strong>정석 상담</strong><small>판매 상품과 검증된 팩트 안에서 답합니다</small></div><button onClick={() => setOpen(false)} aria-label="닫기">×</button></header>
      <div className="chat-body">
        {turns.map((turn, index) => <div key={index} className={turn.role === "assistant" ? "assistant-message" : "user-message"}>{turn.role === "assistant" && <SparkIcon size={17} />}<div><p>{turn.content}</p>{turn.products && turn.products.length > 0 && <div className="chat-products">{turn.products.map((product) => <Link key={product.id} href={`/products/${product.slug}`}>{product.name}<span>{product.price.toLocaleString("ko-KR")}원 →</span></Link>)}</div>}</div></div>)}
        {turns.length === 1 && <button className="suggestion" onClick={() => ask("20만원 안에서 재택근무 책상 구성해줘")}>20만원 안에서 재택근무 책상 구성해줘 <ArrowIcon size={16} /></button>}
        {pending && <div className="chat-thinking"><i /><i /><i /></div>}
      </div>
      <form className="chat-form" onSubmit={submit}><input name="message" required minLength={2} maxLength={1000} placeholder="무엇을 찾고 계신가요?" /><button disabled={pending} aria-label="보내기"><ArrowIcon /></button></form>
    </div>}
  </>;
}
