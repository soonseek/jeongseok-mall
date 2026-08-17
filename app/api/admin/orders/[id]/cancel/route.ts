import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { getCancellationByKey, getOrderPaymentForCancel, completeCancellation } from "@/lib/db/admin";
import { writeAuditLog } from "@/lib/db/audit";
import { getIntegrationSecret } from "@/lib/db/integrations";
import { decryptCredential } from "@/lib/security/credentials";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const cancelSchema = z.object({ reason: z.string().trim().min(2).max(200), idempotencyKey: z.uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  if (!["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "주문 취소 권한이 없습니다." }, { status: 403 });
  }
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "취소 사유를 확인해 주세요." }, { status: 400 });
  const orderId = (await params).id;
  const duplicate = await getCancellationByKey(parsed.data.idempotencyKey);
  if (duplicate?.status === "COMPLETED") {
    if (duplicate.order_id !== orderId) return NextResponse.json({ error: "이미 다른 주문에 사용한 요청 키입니다." }, { status: 409 });
    return NextResponse.json({ ok: true, alreadyCanceled: true });
  }
  const order = await getOrderPaymentForCancel(orderId);
  if (!order) return NextResponse.json({ error: "주문을 찾지 못했습니다." }, { status: 404 });
  if (order.order_status !== "PAID" || order.payment_status !== "APPROVED" || !order.payment_key) return NextResponse.json({ error: "승인된 결제만 취소할 수 있습니다." }, { status: 409 });
  const integration = await getIntegrationSecret("TOSS_PAYMENTS", "TEST");
  if (!integration?.encrypted_secret || !integration.secret_nonce || !integration.secret_tag) return NextResponse.json({ error: "토스 테스트 연동이 설정되지 않았습니다." }, { status: 503 });
  const secret = await decryptCredential({ encryptedSecret: integration.encrypted_secret, nonce: integration.secret_nonce, tag: integration.secret_tag });
  const authorization = `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
  const verification = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}`, { headers: { Authorization: authorization }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!verification.ok) return NextResponse.json({ error: "취소 전 결제 상태를 재확인하지 못했습니다." }, { status: 502 });
  const verified = await verification.json() as Record<string, unknown>;
  if (verified.status !== "DONE" || Number(verified.balanceAmount ?? verified.totalAmount ?? 0) !== order.amount) return NextResponse.json({ error: "현재 결제 원장 상태나 취소 가능 금액이 일치하지 않습니다." }, { status: 409 });
  const tossResponse = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`, { method: "POST", headers: { "Authorization": `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "Content-Type": "application/json", "Idempotency-Key": parsed.data.idempotencyKey }, body: JSON.stringify({ cancelReason: parsed.data.reason }) });
  const payload = await tossResponse.json() as Record<string, unknown>;
  if (!tossResponse.ok) return NextResponse.json({ error: String(payload.message ?? "토스 결제 취소에 실패했습니다.") }, { status: tossResponse.status });
  await completeCancellation({ orderId: order.order_id, paymentId: order.payment_id, reason: parsed.data.reason, amount: order.amount, actorId: auth.id, idempotencyKey: parsed.data.idempotencyKey, payload });
  await writeAuditLog({ actorId: auth.id, action: "PAYMENT_CANCELED", entityType: "order", entityId: order.order_id, summary: { amount: order.amount, reason: parsed.data.reason } });
  return NextResponse.json({ ok: true });
}
