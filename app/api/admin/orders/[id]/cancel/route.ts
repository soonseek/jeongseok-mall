import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { getOrderPaymentForCancel, completeCancellation } from "@/lib/db/admin";
import { writeAuditLog } from "@/lib/db/audit";
import { getIntegrationSecret } from "@/lib/db/integrations";
import { decryptCredential } from "@/lib/security/credentials";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const cancelSchema = z.object({ reason: z.string().trim().min(2).max(200), idempotencyKey: z.uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request, true);
  if (auth instanceof NextResponse) return auth;
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "취소 사유를 확인해 주세요." }, { status: 400 });
  const order = await getOrderPaymentForCancel((await params).id);
  if (!order) return NextResponse.json({ error: "주문을 찾지 못했습니다." }, { status: 404 });
  if (order.order_status !== "PAID" || order.payment_status !== "APPROVED" || !order.payment_key) return NextResponse.json({ error: "승인된 결제만 취소할 수 있습니다." }, { status: 409 });
  const integration = await getIntegrationSecret("TOSS_PAYMENTS", "TEST");
  if (!integration?.encrypted_secret || !integration.secret_nonce || !integration.secret_tag) return NextResponse.json({ error: "토스 테스트 연동이 설정되지 않았습니다." }, { status: 503 });
  const secret = await decryptCredential({ encryptedSecret: integration.encrypted_secret, nonce: integration.secret_nonce, tag: integration.secret_tag });
  const tossResponse = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`, { method: "POST", headers: { "Authorization": `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "Content-Type": "application/json", "Idempotency-Key": parsed.data.idempotencyKey }, body: JSON.stringify({ cancelReason: parsed.data.reason }) });
  const payload = await tossResponse.json() as Record<string, unknown>;
  if (!tossResponse.ok) return NextResponse.json({ error: String(payload.message ?? "토스 결제 취소에 실패했습니다.") }, { status: tossResponse.status });
  await completeCancellation({ orderId: order.order_id, paymentId: order.payment_id, reason: parsed.data.reason, amount: order.amount, actorId: auth.id, idempotencyKey: parsed.data.idempotencyKey, payload });
  await writeAuditLog({ actorId: auth.id, action: "PAYMENT_CANCELED", entityType: "order", entityId: order.order_id, summary: { amount: order.amount, reason: parsed.data.reason } });
  return NextResponse.json({ ok: true });
}
