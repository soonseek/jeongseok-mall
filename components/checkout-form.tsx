"use client";

import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { createClientId } from "@/lib/client-id";
import { formatWon } from "@/lib/format";

export function CheckoutForm({ customer }: { customer: { id: string; name: string; email: string } }) {
  const { items, subtotal } = useCart();
  const shippingFee = subtotal >= 50000 || subtotal === 0 ? 0 : 3000;
  const amount = subtotal + shippingFee;
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useMemo(() => createClientId(), []);

  useEffect(() => {
    let active = true;
    fetch("/api/payments/toss/config").then((response) => response.json()).then(async (config) => {
      if (!active) return;
      setConfigured(Boolean(config.configured));
      if (!config.configured) return;
      const toss = await loadTossPayments(config.clientKey);
      if (active) setWidgets(toss.widgets({ customerKey: customer.id }));
    }).catch(() => setConfigured(false));
    return () => { active = false; };
  }, [customer.id]);

  useEffect(() => {
    if (!widgets || amount <= 0) return;
    let active = true;
    (async () => {
      await widgets.setAmount({ currency: "KRW", value: amount });
      await Promise.all([
        widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
        widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
      ]);
      if (active) setReady(true);
    })().catch(() => active && setError("결제 수단을 불러오지 못했습니다."));
    return () => { active = false; };
  }, [widgets, amount]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!widgets || !ready || items.length === 0) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const customerName = String(form.get("customerName"));
    const email = String(form.get("email"));
    const phone = String(form.get("phone")).replace(/\D/g, "");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "x-jeongseok-request": "1" },
      body: JSON.stringify({ customerName, email, phone, postalCode: form.get("postalCode"), address: form.get("address"), addressDetail: form.get("addressDetail"), idempotencyKey, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })) }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "주문을 만들지 못했습니다.");
      setPending(false);
      return;
    }
    try {
      await widgets.requestPayment({
        orderId: result.order.orderNumber,
        orderName: result.order.orderName,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerEmail: email,
        customerName,
        customerMobilePhone: phone,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "결제창을 열지 못했습니다.");
      setPending(false);
    }
  }

  if (items.length === 0) return <section className="checkout-empty"><strong>결제할 상품이 없습니다.</strong><Link href="/products">상품 고르기</Link></section>;
  return <form className="checkout-layout" onSubmit={submit}>
    <section className="checkout-fields">
      <div className="checkout-section-title"><span>01</span><h2>주문자 정보</h2></div>
      <div className="field-grid"><label><span>이름</span><input name="customerName" required maxLength={100} defaultValue={customer.name} /></label><label><span>휴대전화</span><input name="phone" required inputMode="numeric" placeholder="01012345678" /></label><label className="wide"><span>이메일</span><input name="email" type="email" required value={customer.email} readOnly /></label></div>
      <div className="checkout-section-title"><span>02</span><h2>배송지</h2></div>
      <div className="field-grid"><label><span>우편번호</span><input name="postalCode" required /></label><label className="wide"><span>주소</span><input name="address" required /></label><label className="wide"><span>상세 주소</span><input name="addressDetail" /></label></div>
      <div className="checkout-section-title"><span>03</span><h2>결제 수단</h2></div>
      {configured === false && <div className="payment-unconfigured"><strong>토스 테스트 키가 아직 등록되지 않았습니다.</strong><p>관리자 → 외부 연동에서 토스페이먼츠 테스트 키를 저장하면 결제 UI가 활성화됩니다.</p></div>}
      <div id="payment-method" className="toss-widget" />
      <div id="agreement" className="toss-widget" />
    </section>
    <aside className="checkout-summary"><span className="kicker">PAYMENT</span><h2>최종 결제</h2>{items.map((item) => <div className="checkout-line" key={item.productId}><span>{item.name} × {item.quantity}</span><strong>{formatWon(item.price * item.quantity)}</strong></div>)}<dl><div><dt>상품 금액</dt><dd>{formatWon(subtotal)}</dd></div><div><dt>배송비</dt><dd>{shippingFee ? formatWon(shippingFee) : "무료"}</dd></div><div className="total"><dt>총 결제 금액</dt><dd>{formatWon(amount)}</dd></div></dl>{error && <p className="form-error">{error}</p>}<button className="admin-primary-button" disabled={!ready || pending}>{pending ? "결제 요청 중…" : `${formatWon(amount)} 결제하기`}</button><small>토스페이먼츠 테스트 결제창으로 이동합니다. 실결제는 발생하지 않습니다.</small></aside>
  </form>;
}
