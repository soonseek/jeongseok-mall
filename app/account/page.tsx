import Link from "next/link";
import { ArrowIcon, UserIcon } from "@/components/icons";
import { CustomerLoginForm, CustomerLogoutButton } from "@/components/customer-auth";
import { currentCustomer } from "@/lib/auth";
import { listCustomerOrders } from "@/lib/db/orders";
import { formatWon } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const customer = await currentCustomer();
  if (!customer) return <main className="account-page"><div className="account-card account-login-card">
    <UserIcon size={36} /><span className="kicker">CUSTOMER ACCOUNT</span><h1>데모 고객 로그인</h1>
    <p>테스트 결제와 본인 주문 상담을 위한 가상 고객 계정입니다.</p>
    <CustomerLoginForm redirectTo={(await searchParams).next} />
  </div></main>;

  const orders = await listCustomerOrders(customer.id);
  return <main className="account-page"><section className="account-dashboard">
    <header><div><span className="kicker">CUSTOMER ACCOUNT</span><h1>{customer.name}님의 정석</h1><p>{customer.email}</p></div><CustomerLogoutButton /></header>
    <div className="account-status"><span>현재 상태</span><strong>데모 고객 인증 완료</strong></div>
    <section className="account-orders"><div className="section-heading"><div><span className="kicker">MY ORDERS</span><h2>내 주문</h2></div><Link href="/products">새 상품 보기 <ArrowIcon /></Link></div>
      {orders.length === 0 ? <div className="account-empty"><strong>아직 주문이 없습니다.</strong><p>상품을 담고 테스트 결제를 진행하면 여기에 표시됩니다.</p></div> : orders.map((order) => <Link className="account-order-row" href={`/account/orders/${order.id}`} key={order.id}><div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString("ko-KR")}</small></div><b>{formatWon(order.total_amount)}</b><span className={`status-badge ${order.status === "PAID" ? "ready" : "unverified"}`}>{order.status}</span><ArrowIcon /></Link>)}
    </section>
  </section></main>;
}
