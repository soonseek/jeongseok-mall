import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { adminProducts, updateAdminProduct } from "@/lib/db/admin";
import { writeAuditLog } from "@/lib/db/audit";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const productSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().min(5).max(300), price: z.number().int().min(0).max(100_000_000),
  stock: z.number().int().min(0).max(1_000_000), status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]), featured: z.boolean(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ products: await adminProducts() });
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "상품 정보를 확인해 주세요." }, { status: 400 });
  if (!(await updateAdminProduct(parsed.data))) return NextResponse.json({ error: "상품을 찾지 못했습니다." }, { status: 404 });
  await writeAuditLog({ actorId: auth.id, action: "PRODUCT_UPDATED", entityType: "product", entityId: parsed.data.id, summary: { name: parsed.data.name, status: parsed.data.status, price: parsed.data.price, stock: parsed.data.stock } });
  return NextResponse.json({ ok: true });
}
