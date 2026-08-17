import { IntegrationSettings } from "@/components/integration-settings";
import { requireAdmin } from "@/lib/auth";
import { listIntegrations } from "@/lib/db/integrations";

export default async function IntegrationsPage() {
  const admin = await requireAdmin();
  return <>
    <header className="admin-page-header"><div><span>SYSTEM SETTINGS</span><h1>외부 연동</h1><p>결제와 AI 공급자 키를 관리자 화면에서 입력하고 교체합니다.</p></div></header>
    <main className="admin-page-body">
      <div className="admin-notice"><strong>키는 저장 즉시 AES-256-GCM으로 암호화됩니다.</strong><p>화면에는 마지막 네 자리만 다시 표시하며, 실행 로그와 오류 메시지에는 원문을 남기지 않습니다.</p></div>
      <IntegrationSettings initial={await listIntegrations()} canEdit={admin.role === "SUPER_ADMIN"} />
    </main>
  </>;
}
