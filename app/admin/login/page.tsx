import { redirect } from "next/navigation";
import { AdminAuthForm } from "@/components/admin-auth-form";
import { currentAdmin } from "@/lib/auth";
import { hasAnyAdmin } from "@/lib/db/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (!(await hasAnyAdmin())) redirect("/admin/setup");
  if (await currentAdmin()) redirect("/admin");
  return <main className="admin-auth-page"><section className="admin-auth-card">
    <div className="admin-mark"><strong>정석</strong><span>MALL ADMIN</span></div>
    <p className="admin-eyebrow">SECURE ACCESS</p>
    <h1>관리자 로그인</h1>
    <p>상품, 주문, 상담 에이전트와 콘텐츠 자동화를 한곳에서 관리합니다.</p>
    <AdminAuthForm mode="login" />
  </section></main>;
}
