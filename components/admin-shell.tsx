"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navigation = [
  ["/admin", "전체 현황"],
  ["/admin/products", "상품 관리"],
  ["/admin/orders", "주문·결제"],
  ["/admin/support", "상담 관제"],
  ["/admin/content", "콘텐츠 생산"],
  ["/admin/integrations", "외부 연동"],
];

export function AdminShell({ adminName, children }: { adminName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", headers: { "x-jeongseok-request": "1" } });
    router.push("/admin/login");
    router.refresh();
  }

  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin"><strong>정석</strong><span>MALL ADMIN</span></Link>
      <nav>{navigation.map(([href, label]) => <Link key={href} className={pathname === href ? "active" : ""} href={href}>{label}</Link>)}</nav>
      <div className="admin-user"><span>{adminName}</span><button onClick={logout}>로그아웃</button></div>
    </aside>
    <div className="admin-main">{children}</div>
  </div>;
}
