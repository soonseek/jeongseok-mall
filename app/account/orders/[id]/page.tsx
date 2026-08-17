import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { getCustomerOrder } from "@/lib/db/orders";
import { formatWon } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await requireCustomer();
  const order = await getCustomerOrder(customer.id, (await params).id);
  if (!order) notFound();
  return <main className="account-page"><section className="account-dashboard order-detail-card">
    <header><div><span className="kicker">ORDER DETAIL</span><h1>{order.order_number}</h1><p>{new Date(order.created_at).toLocaleString("ko-KR")}</p></div><Link href="/account">목록으로</Link></header>
    <div className="order-detail-status"><span>주문 상태 <b>{order.status}</b></span><span>결제 상태 <b>{order.payment_status ?? "READY"}</b></span><span>결제 수단 <b>{order.method ?? "-"}</b></span></div>
    <div className="order-detail-lines">{order.items.map((item) => <div key={item.id}><span>{item.product_name} × {item.quantity}</span><strong>{formatWon(item.line_total)}</strong></div>)}<div className="total"><span>총 결제 금액</span><strong>{formatWon(order.total_amount)}</strong></div></div>
    <div className="order-contact"><div><span>받는 사람</span><strong>{order.customer_name}</strong><small>{order.phone}</small></div><div><span>배송지</span><strong>{order.shipping_address.address}</strong><small>{order.shipping_address.addressDetail} · {order.shipping_address.postalCode}</small></div></div>
    {order.receipt_url && <a className="primary-button" href={order.receipt_url} target="_blank" rel="noreferrer">테스트 결제 영수증</a>}
  </section></main>;
}
