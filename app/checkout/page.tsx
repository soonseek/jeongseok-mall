import { CheckoutForm } from "@/components/checkout-form";
import Link from "next/link";
import { currentCustomer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customer = await currentCustomer();
  return <main><header className="simple-hero"><span className="kicker">SECURE CHECKOUT</span><h1>주문서</h1><p>주문 금액과 고객 소유권을 서버에서 다시 확인한 뒤 토스페이먼츠에 전달합니다.</p></header>{customer ? <CheckoutForm customer={{ id: customer.id, name: customer.name, email: customer.email }} /> : <section className="checkout-empty"><strong>고객 로그인이 필요합니다.</strong><p>다른 고객의 주문·결제에 접근하지 못하도록 로그인 후 주문을 만듭니다.</p><Link href="/account?next=/checkout">데모 고객으로 로그인</Link></section>}</main>;
}
