import { redirect } from "next/navigation";
import { AdminAuthForm } from "@/components/admin-auth-form";
import { hasAnyAdmin } from "@/lib/db/auth";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  if (await hasAnyAdmin()) redirect("/admin/login");
  return <main className="admin-auth-page"><section className="admin-auth-card">
    <div className="admin-mark"><strong>정석</strong><span>MALL ADMIN</span></div>
    <p className="admin-eyebrow">FIRST RUN</p>
    <h1>최초 관리자 설정</h1>
    <p>외부 연동 키와 결제 설정을 보호할 최고 관리자 계정을 만듭니다. 이 단계는 한 번만 열립니다.</p>
    <AdminAuthForm mode="setup" />
  </section></main>;
}
