import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { transitionDetailVersion, updateDetailDraft } from "@/lib/db/content";
import { writeAuditLog } from "@/lib/db/audit";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const blockSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["hero", "problem", "features", "proof", "specs", "recommendation", "faq", "cta"]),
  eyebrow: z.string().max(120).optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().max(2000).optional(),
  items: z.array(z.object({ title: z.string().max(200), body: z.string().max(1000), factIds: z.array(z.string().max(120)).max(20) })).max(20).optional(),
  factIds: z.array(z.string().max(120)).max(50),
});
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["request_review", "approve", "reject", "publish"]) }),
  z.object({ action: z.literal("save_draft"), title: z.string().trim().min(2).max(200), seoTitle: z.string().trim().min(2).max(200), seoDescription: z.string().trim().min(5).max(500), blocks: z.array(blockSchema).min(1).max(30) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청한 상태 변경을 확인해 주세요." }, { status: 400 });
  if (["approve", "reject", "publish"].includes(parsed.data.action) && !["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "관리자 승인 권한이 필요합니다." }, { status: 403 });
  }
  try {
    const detail = parsed.data.action === "save_draft"
      ? await updateDetailDraft((await params).id, parsed.data)
      : await transitionDetailVersion((await params).id, parsed.data.action, auth.id);
    await writeAuditLog({
      actorId: auth.id,
      action: `DETAIL_${parsed.data.action.toUpperCase()}`,
      entityType: "detail_page_version",
      entityId: detail.id,
      summary: { productId: detail.productId, version: detail.version, status: detail.status },
    });
    return NextResponse.json({ detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "DETAIL_NOT_FOUND") return NextResponse.json({ error: "상세페이지 버전을 찾지 못했습니다." }, { status: 404 });
    if (message === "INVALID_DETAIL_TRANSITION") return NextResponse.json({ error: "현재 상태에서 요청한 단계로 옮길 수 없습니다." }, { status: 409 });
    if (message === "DETAIL_NOT_EDITABLE") return NextResponse.json({ error: "초안 또는 반려 상태에서만 수정할 수 있습니다." }, { status: 409 });
    throw error;
  }
}
