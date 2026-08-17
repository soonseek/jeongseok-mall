import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getIntegrationSecretById, recordIntegrationCheck } from "@/lib/db/integrations";
import { writeAuditLog } from "@/lib/db/audit";
import { decryptCredential } from "@/lib/security/credentials";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const admin = await requireAdminApi(request, true);
  if (admin instanceof NextResponse) return admin;
  const integration = await getIntegrationSecretById((await params).id);
  if (!integration?.encrypted_secret || !integration.secret_nonce || !integration.secret_tag) return NextResponse.json({ error: "검사할 자격증명이 없습니다." }, { status: 404 });
  const secret = await decryptCredential({ encryptedSecret: integration.encrypted_secret, nonce: integration.secret_nonce, tag: integration.secret_tag });
  const startedAt = Date.now();
  let passed = false;
  let message = "연결 검사에 실패했습니다.";
  try {
    if (integration.kind === "TOSS_PAYMENTS") {
      const clientKey = String(integration.settings.clientKey ?? "");
      if (!clientKey.startsWith("test_ck_") || !secret.startsWith("test_sk_")) throw new Error("테스트 키 형식이 일치하지 않습니다.");
      const response = await fetch("https://api.tosspayments.com/v1/payments/orders/JEONGSEOK_HEALTH_CHECK", {
        headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` }, cache: "no-store", signal: AbortSignal.timeout(8_000),
      });
      passed = response.status !== 401 && response.status !== 403;
      message = passed ? "토스 테스트 API 인증과 클라이언트 키 형식을 확인했습니다." : "토스 테스트 API가 자격증명을 거부했습니다.";
    } else {
      const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      passed = response.ok;
      message = passed ? `${integration.label} API 인증을 확인했습니다. 과금 생성 요청은 실행하지 않았습니다.` : `${integration.label} API가 자격증명을 거부했습니다.`;
    }
  } catch (error) {
    message = error instanceof Error ? error.message : message;
  }
  const saved = await recordIntegrationCheck({ id: integration.id, passed, message, latencyMs: Date.now() - startedAt, actorId: admin.id });
  await writeAuditLog({ actorId: admin.id, action: "INTEGRATION_CHECKED", entityType: "integration_config", entityId: integration.id, summary: { passed, latencyMs: Date.now() - startedAt } });
  return NextResponse.json({ integration: saved, passed, message }, { status: passed ? 200 : 422 });
}
