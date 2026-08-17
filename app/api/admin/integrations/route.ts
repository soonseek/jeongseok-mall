import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { writeAuditLog } from "@/lib/db/audit";
import { disableIntegration, listIntegrations, saveIntegration } from "@/lib/db/integrations";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const integrationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TOSS_PAYMENTS"), provider: z.literal("TOSS_PAYMENTS"),
    label: z.string().trim().min(2).max(80), environment: z.enum(["TEST", "LIVE"]),
    secret: z.string().trim().max(500).optional(),
    settings: z.object({ clientKey: z.string().trim().min(8).max(500) }),
  }),
  z.object({
    kind: z.literal("AI_MODEL"), provider: z.enum(["OPENAI"]),
    label: z.string().trim().min(2).max(80), environment: z.enum(["TEST", "LIVE"]),
    secret: z.string().trim().max(500).optional(),
    settings: z.object({ model: z.string().trim().min(2).max(100) }),
  }),
  z.object({
    kind: z.literal("TTS"), provider: z.enum(["OPENAI"]),
    label: z.string().trim().min(2).max(80), environment: z.enum(["TEST", "LIVE"]),
    secret: z.string().trim().max(500).optional(),
    settings: z.object({ model: z.string().trim().min(2).max(100), voice: z.string().trim().min(2).max(80) }),
  }),
]);

function validMutation(request: NextRequest): boolean {
  return isSameOrigin(request) && hasAdminRequestHeader(request);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ integrations: await listIntegrations(), canEdit: auth.role === "SUPER_ADMIN" });
}

export async function PUT(request: NextRequest) {
  if (!validMutation(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request, true);
  if (auth instanceof NextResponse) return auth;
  const parsed = integrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "연동 설정값을 확인해 주세요." }, { status: 400 });
  if (!parsed.data.secret) {
    const existing = (await listIntegrations()).find((item) => item.kind === parsed.data.kind && item.environment === parsed.data.environment);
    if (!existing?.key_suffix) return NextResponse.json({ error: "처음 저장할 때는 비밀 키가 필요합니다." }, { status: 400 });
  }
  const saved = await saveIntegration({ ...parsed.data, actorId: auth.id });
  await writeAuditLog({ actorId: auth.id, action: "INTEGRATION_SAVED", entityType: "integration_config", entityId: saved.id, summary: { kind: saved.kind, environment: saved.environment, keySuffix: saved.key_suffix } });
  return NextResponse.json({ integration: saved });
}

export async function DELETE(request: NextRequest) {
  if (!validMutation(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const auth = await requireAdminApi(request, true);
  if (auth instanceof NextResponse) return auth;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "연동 ID가 필요합니다." }, { status: 400 });
  const changed = await disableIntegration(id, auth.id);
  if (!changed) return NextResponse.json({ error: "연동을 찾지 못했습니다." }, { status: 404 });
  await writeAuditLog({ actorId: auth.id, action: "INTEGRATION_DISABLED", entityType: "integration_config", entityId: id });
  return NextResponse.json({ ok: true });
}
