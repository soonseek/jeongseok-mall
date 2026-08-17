import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { renderLocalShort } from "@/lib/content/local-renderer";
import { writeAuditLog } from "@/lib/db/audit";
import { getShortProject, markShortFailed, markShortReady, markShortRendering } from "@/lib/db/content";
import { getProductById } from "@/lib/db/products";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

export const maxDuration = 300;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  const id = (await params).id;
  const project = await getShortProject(id);
  if (!project) return NextResponse.json({ error: "쇼츠 프로젝트를 찾지 못했습니다." }, { status: 404 });
  if (!["SCRIPT_READY", "FAILED"].includes(project.status)) return NextResponse.json({ error: "현재 상태에서 렌더할 수 없습니다." }, { status: 409 });
  const product = await getProductById(project.productId);
  if (!product) return NextResponse.json({ error: "상품을 찾지 못했습니다." }, { status: 404 });
  await markShortRendering(id);
  try {
    await renderLocalShort(project, product);
    const urls = {
      video: `/api/admin/content/artifacts/${id}?type=mp4`,
      captions: `/api/admin/content/artifacts/${id}?type=srt`,
      thumbnail: `/api/admin/content/artifacts/${id}?type=thumbnail`,
    };
    await markShortReady(id, urls);
    await writeAuditLog({ actorId: auth.id, action: "LOCAL_SHORT_RENDERED", entityType: "short_project", entityId: id, summary: { durationSeconds: project.durationSeconds, externalDataTransfer: false } });
    return NextResponse.json({ short: await getShortProject(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_RENDER_ERROR";
    await markShortFailed(id, message);
    return NextResponse.json({ error: `로컬 렌더에 실패했습니다: ${message.slice(0, 160)}` }, { status: 500 });
  }
}
