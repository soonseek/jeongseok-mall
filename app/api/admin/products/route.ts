import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { adminProducts, createAdminProduct, updateAdminProduct } from "@/lib/db/admin";
import { writeAuditLog } from "@/lib/db/audit";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const productFields = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  name: z.string().trim().min(2).max(120), category: z.enum(["DESK", "MOBILE", "FOCUS", "TRAVEL"]),
  shortDescription: z.string().trim().min(5).max(300), description: z.string().trim().min(10).max(2000),
  price: z.number().int().min(0).max(100_000_000), compareAtPrice: z.number().int().min(0).max(100_000_000).nullable(),
  stock: z.number().int().min(0).max(1_000_000), status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]), featured: z.boolean(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  facts: z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_-]*$/).max(60), value: z.string().trim().min(1).max(500), evidence: z.string().trim().min(1).max(300) })).max(30),
});
const productSchema = productFields.extend({ id: z.string().min(1).max(100) });

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
  try {
    if (!(await updateAdminProduct(parsed.data))) return NextResponse.json({ error: "상품을 찾지 못했습니다." }, { status: 404 });
    await writeAuditLog({ actorId: auth.id, action: "PRODUCT_UPDATED", entityType: "product", entityId: parsed.data.id, summary: { name: parsed.data.name, status: parsed.data.status, price: parsed.data.price, stock: parsed.data.stock, factCount: parsed.data.facts.length } });
    return NextResponse.json({ ok: true, product: (await adminProducts()).find((product) => product.id === parsed.data.id) });
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) return NextResponse.json({ error: "이미 사용 중인 상품 URL 또는 팩트 키입니다." }, { status: 409 });
    throw error;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = productFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "새 상품과 팩트 정보를 확인해 주세요." }, { status: 400 });
  try {
    const product = await createAdminProduct(parsed.data);
    await writeAuditLog({ actorId: auth.id, action: "PRODUCT_CREATED", entityType: "product", entityId: product.id, summary: { name: product.name, status: product.status, factCount: product.facts.length } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) return NextResponse.json({ error: "이미 사용 중인 상품 URL 또는 팩트 키입니다." }, { status: 409 });
    throw error;
  }
}
