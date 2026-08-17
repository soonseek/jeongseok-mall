import { OrderAdminTable } from "@/components/order-admin-table";
import { adminOrders } from "@/lib/db/admin";

export default async function AdminOrdersPage() {
  const orders = await adminOrders();
  return <><header className="admin-page-header"><div><span>COMMERCE</span><h1>주문·결제</h1><p>주문과 토스페이먼츠 승인·취소 상태를 함께 확인합니다.</p></div><b>{orders.length} ORDERS</b></header><main className="admin-page-body"><OrderAdminTable initial={orders} /></main></>;
}
