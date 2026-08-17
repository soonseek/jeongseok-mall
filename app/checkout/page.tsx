import { CheckoutForm } from "@/components/checkout-form";

export default function CheckoutPage() {
  return <main><header className="simple-hero"><span className="kicker">SECURE CHECKOUT</span><h1>주문서</h1><p>주문 금액은 서버에서 다시 계산한 뒤 토스페이먼츠에 전달합니다.</p></header><CheckoutForm /></main>;
}
