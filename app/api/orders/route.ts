import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/db/orders";
import { allowAttempt, hasAdminRequestHeader, isSameOrigin, requestFingerprint } from "@/lib/security/request";

const orderSchema = z.object({
  email: z.email().max(100), customerName: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^01\d{8,9}$/), postalCode: z.string().trim().min(3).max(12),
  address: z.string().trim().min(3).max(200), addressDetail: z.string().trim().max(200),
  idempotencyKey: z.uuid(),
  items: z.array(z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(20) })).min(1).max(30),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  if (!allowAttempt(requestFingerprint(request, "create-order"), 20, 10 * 60 * 1000)) return NextResponse.json({ error: "주문 요청이 너무 많습니다." }, { status: 429 });
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "주문 정보를 확인해 주세요." }, { status: 400 });
  try {
    return NextResponse.json({ order: await createOrder(parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["PRODUCT_NOT_FOUND", "PRODUCT_UNAVAILABLE"].includes(error.message)) {
      return NextResponse.json({ error: "판매 중인 상품과 재고를 다시 확인해 주세요." }, { status: 409 });
    }
    throw error;
  }
}
