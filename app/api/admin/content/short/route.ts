import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { createLocalShortProject } from "@/lib/db/content";
import { writeAuditLog } from "@/lib/db/audit";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const schema = z.object({
  productId: z.string().min(1).max(100),
  detailPageVersionId: z.string().min(1).max(100),
  durationSeconds: z.union([z.literal(15), z.literal(30)]),
  angle: z.string().trim().min(2).max(120),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "쇼츠 설정을 확인해 주세요." }, { status: 400 });
  try {
    const short = await createLocalShortProject({ ...parsed.data, actorId: auth.id });
    await writeAuditLog({ actorId: auth.id, action: "LOCAL_SHORT_SCRIPT_CREATED", entityType: "short_project", entityId: short.id, summary: { productId: parsed.data.productId, durationSeconds: parsed.data.durationSeconds, externalDataTransfer: false } });
    return NextResponse.json({ short });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "쇼츠 대본을 만들지 못했습니다." }, { status: 400 });
  }
}

