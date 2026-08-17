import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { updateShortDraft } from "@/lib/db/content";
import { writeAuditLog } from "@/lib/db/audit";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const sceneSchema = z.object({
  scene: z.number().int().min(1).max(20), startSeconds: z.number().min(0).max(30), duration: z.number().positive().max(30),
  voice: z.string().trim().min(1).max(1000), onScreen: z.string().trim().min(1).max(300), visual: z.string().trim().min(1).max(1000),
  shotType: z.enum(["PROBLEM", "MASTER_PRODUCT", "USE", "FACT", "RESULT", "CTA"]),
  transition: z.enum(["CUT", "MATCH_CUT", "PUSH", "HOLD"]), factIds: z.array(z.string().max(120)).max(30),
});
const schema = z.object({ selectedHook: z.string().trim().min(1).max(300), script: z.array(sceneSchema).min(1).max(20) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const admin = await requireAdminApi(request);
  if (admin instanceof NextResponse) return admin;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "쇼츠 대본을 확인해 주세요." }, { status: 400 });
  try {
    const short = await updateShortDraft((await params).id, parsed.data);
    await writeAuditLog({ actorId: admin.id, action: "SHORT_SCRIPT_UPDATED", entityType: "short_project", entityId: short.id, summary: { selectedHook: short.selectedHook, sceneCount: short.script.length } });
    return NextResponse.json({ short });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "SHORT_NOT_FOUND") return NextResponse.json({ error: "쇼츠 프로젝트를 찾지 못했습니다." }, { status: 404 });
    if (["SHORT_NOT_EDITABLE", "INVALID_SHORT_HOOK"].includes(message)) return NextResponse.json({ error: "현재 쇼츠 대본을 수정할 수 없습니다." }, { status: 409 });
    throw error;
  }
}
