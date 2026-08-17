import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { createLocalDetailVersion } from "@/lib/db/content";
import { writeAuditLog } from "@/lib/db/audit";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const schema = z.object({ productId: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "상품을 확인해 주세요." }, { status: 400 });
  try {
    const detail = await createLocalDetailVersion(parsed.data.productId, auth.id);
    await writeAuditLog({ actorId: auth.id, action: "LOCAL_DETAIL_DRAFT_CREATED", entityType: "detail_page_version", entityId: detail.id, summary: { productId: parsed.data.productId, version: detail.version, externalDataTransfer: false } });
    return NextResponse.json({ detail });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "상세페이지 초안을 만들지 못했습니다." }, { status: 400 });
  }
}

