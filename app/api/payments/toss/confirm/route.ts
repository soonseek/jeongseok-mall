import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIntegrationSecret } from "@/lib/db/integrations";
import { completeTossPayment, failTossPayment, getPendingOrder } from "@/lib/db/orders";
import { decryptCredential } from "@/lib/security/credentials";
import { allowAttempt, hasAdminRequestHeader, isSameOrigin, requestFingerprint } from "@/lib/security/request";

const confirmSchema = z.object({ paymentKey: z.string().min(10).max(200), orderId: z.string().min(6).max(64), amount: z.number().int().positive() });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  if (!allowAttempt(requestFingerprint(request, "toss-confirm"), 15, 10 * 60 * 1000)) return NextResponse.json({ error: "승인 요청이 너무 많습니다." }, { status: 429 });
  const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "결제 승인 정보를 확인해 주세요." }, { status: 400 });
  const order = await getPendingOrder(parsed.data.orderId);
  if (!order) return NextResponse.json({ error: "주문을 찾지 못했습니다." }, { status: 404 });
  if (order.status === "PAID" && order.payment_status === "APPROVED") return NextResponse.json({ ok: true, alreadyApproved: true });
  if (order.status !== "PAYMENT_PENDING" || Number(order.total_amount) !== parsed.data.amount) {
    return NextResponse.json({ error: "저장된 주문 금액과 인증 금액이 일치하지 않습니다." }, { status: 409 });
  }
  const integration = await getIntegrationSecret("TOSS_PAYMENTS", "TEST");
  if (!integration?.encrypted_secret || !integration.secret_nonce || !integration.secret_tag || integration.status === "DISABLED") {
    return NextResponse.json({ error: "토스페이먼츠 테스트 연동이 설정되지 않았습니다." }, { status: 503 });
  }
  const secretKey = await decryptCredential({ encryptedSecret: integration.encrypted_secret, nonce: integration.secret_nonce, tag: integration.secret_tag });
  const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { "Authorization": `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const payload = await tossResponse.json() as Record<string, unknown>;
  if (!tossResponse.ok) {
    await failTossPayment(order, payload);
    return NextResponse.json({ error: String(payload.message ?? "토스페이먼츠 승인에 실패했습니다."), code: payload.code }, { status: tossResponse.status });
  }
  await completeTossPayment({ order, paymentKey: parsed.data.paymentKey, payload });
  return NextResponse.json({ ok: true, payment: { orderId: parsed.data.orderId, method: payload.method, approvedAt: payload.approvedAt, receiptUrl: (payload.receipt as { url?: string } | undefined)?.url ?? null } });
}
