"use client";

import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";
import { useCart } from "@/components/cart-provider";
import { formatWon } from "@/lib/format";

export default function CartPage() {
  const { items, subtotal, update, remove } = useCart();
  const shipping = subtotal >= 50000 || subtotal === 0 ? 0 : 3000;
  return <main className="cart-page">
    <header className="simple-hero"><span className="kicker">YOUR SELECTION</span><h1>장바구니</h1><p>상품 가격은 서버가 다시 계산하고 토스페이먼츠 테스트 결제로 이어집니다.</p></header>
    {items.length === 0 ? <section className="empty-cart"><strong>아직 담은 상품이 없습니다.</strong><p>당신의 흐름에 필요한 도구부터 골라보세요.</p><Link className="primary-button" href="/products">상품 보러 가기 <ArrowIcon /></Link></section> : <section className="cart-layout">
      <div className="cart-lines">{items.map((item) => <article key={item.productId}>
        <Link href={`/products/${item.slug}`} className="cart-art"><ProductArt compact product={{ name: item.name, category: "DESK", accent: item.accent }} /></Link>
        <div><Link href={`/products/${item.slug}`}><h2>{item.name}</h2></Link><span>가상 상품 · 테스트 결제</span><strong>{formatWon(item.price)}</strong></div>
        <div className="quantity-control"><button onClick={() => update(item.productId, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => update(item.productId, item.quantity + 1)}>+</button></div>
        <strong className="line-total">{formatWon(item.price * item.quantity)}</strong>
        <button className="remove-line" onClick={() => remove(item.productId)}>삭제</button>
      </article>)}</div>
      <aside className="order-summary"><span className="kicker">ORDER SUMMARY</span><h2>결제 예상 금액</h2><dl><div><dt>상품 금액</dt><dd>{formatWon(subtotal)}</dd></div><div><dt>배송비</dt><dd>{shipping ? formatWon(shipping) : "무료"}</dd></div><div className="summary-total"><dt>총 결제 금액</dt><dd>{formatWon(subtotal + shipping)}</dd></div></dl><Link className="primary-button" href="/checkout">주문서로 이동 <ArrowIcon /></Link><small>실제 과금이 없는 토스페이먼츠 테스트 환경에서만 진행됩니다.</small></aside>
    </section>}
  </main>;
}
