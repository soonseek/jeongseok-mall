import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIntegrationSecret } from "@/lib/db/integrations";
import { processVerifiedTossWebhook } from "@/lib/db/orders";
import { decryptCredential } from "@/lib/security/credentials";

const eventSchema = z.object({
  eventType: z.literal("PAYMENT_STATUS_CHANGED"),
  createdAt: z.string().min(10).max(80),
  data: z.object({ paymentKey: z.string().min(10).max(200), orderId: z.string().min(6).max(64) }).passthrough(),
});

export async function POST(request: NextRequest) {
  const transmissionId = request.headers.get("tosspayments-webhook-transmission-id");
  if (!transmissionId || transmissionId.length > 200) return NextResponse.json({ error: "웹훅 전송 ID가 없습니다." }, { status: 400 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "지원하지 않는 웹훅입니다." }, { status: 400 });

  const integration = await getIntegrationSecret("TOSS_PAYMENTS", "TEST");
  if (!integration?.encrypted_secret || !integration.secret_nonce || !integration.secret_tag || integration.status === "DISABLED") {
    return NextResponse.json({ error: "토스페이먼츠 테스트 연동이 설정되지 않았습니다." }, { status: 503 });
  }
  const secret = await decryptCredential({ encryptedSecret: integration.encrypted_secret, nonce: integration.secret_nonce, tag: integration.secret_tag });
  const verifyResponse = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(parsed.data.data.paymentKey)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!verifyResponse.ok) return NextResponse.json({ error: "결제 원장 재검증에 실패했습니다." }, { status: 502 });
  const verified = await verifyResponse.json() as Record<string, unknown>;
  if (String(verified.orderId ?? "") !== parsed.data.data.orderId || String(verified.paymentKey ?? "") !== parsed.data.data.paymentKey) {
    return NextResponse.json({ error: "웹훅과 결제 원장이 일치하지 않습니다." }, { status: 409 });
  }

  try {
    const result = await processVerifiedTossWebhook({ transmissionId, eventType: parsed.data.eventType, payment: verified });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WEBHOOK_PROCESSING_FAILED";
    const status = message === "WEBHOOK_ORDER_NOT_FOUND" ? 404 : message === "WEBHOOK_AMOUNT_MISMATCH" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
