"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart-provider";

export function PaymentResult() {
  const params = useSearchParams();
  const { clear } = useCart();
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = Number(params.get("amount"));
  const validParameters = Boolean(paymentKey && orderId && Number.isInteger(amount) && amount > 0);
  const [state, setState] = useState<"loading" | "success" | "failed">(validParameters ? "loading" : "failed");
  const [message, setMessage] = useState(validParameters ? "결제 승인 결과를 확인하고 있습니다." : "결제 승인 정보가 올바르지 않습니다.");

  useEffect(() => {
    if (!paymentKey || !orderId || !validParameters) return;
    fetch("/api/payments/toss/confirm", { method: "POST", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify({ paymentKey, orderId, amount }) })
      .then(async (response) => ({ ok: response.ok, result: await response.json() }))
      .then(({ ok, result }) => { if (!ok) throw new Error(result.error); clear(); setState("success"); setMessage(`${orderId} 주문의 테스트 결제가 승인되었습니다.`); })
      .catch((error) => { setState("failed"); setMessage(error instanceof Error ? error.message : "결제를 승인하지 못했습니다."); });
  }, [paymentKey, orderId, amount, validParameters, clear]);

  return <main className="result-page"><section><span className="kicker">{state === "success" ? "PAYMENT COMPLETE" : state === "failed" ? "PAYMENT FAILED" : "VERIFYING"}</span><h1>{state === "success" ? "주문이 완료됐습니다." : state === "failed" ? "승인을 완료하지 못했습니다." : "잠시만 기다려 주세요."}</h1><p>{message}</p><Link className="primary-button" href={state === "success" ? "/products" : "/cart"}>{state === "success" ? "계속 둘러보기" : "장바구니로 돌아가기"}</Link></section></main>;
}
