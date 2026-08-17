"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navigation = [
  { href: "/admin", label: "전체 현황", roles: ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/products", label: "상품 관리", roles: ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/orders", label: "주문·결제", roles: ["ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/support", label: "상담 관제", roles: ["ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/content", label: "콘텐츠 생산", roles: ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/users", label: "담당자·권한", roles: ["SUPER_ADMIN"] },
  { href: "/admin/integrations", label: "외부 연동", roles: ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"] },
] as const;

export function AdminShell({ adminName, adminRole, children }: { adminName: string; adminRole: "CONTENT_EDITOR" | "ADMIN" | "SUPER_ADMIN"; children: React.ReactNode }) {
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
      <nav>{navigation.filter((item) => (item.roles as readonly string[]).includes(adminRole)).map((item) => <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>{item.label}</Link>)}</nav>
      <div className="admin-user"><span>{adminName}<small>{adminRole}</small></span><button onClick={logout}>로그아웃</button></div>
    </aside>
    <div className="admin-main">{children}</div>
  </div>;
}
