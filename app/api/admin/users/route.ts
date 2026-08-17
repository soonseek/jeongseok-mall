import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { createStaffUser, listStaffUsers, updateStaffUser } from "@/lib/db/auth";
import { writeAuditLog } from "@/lib/db/audit";
import { hashPassword, validateAdminPassword } from "@/lib/security/password";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const createSchema = z.object({ name: z.string().trim().min(2).max(50), email: z.email().max(200), password: z.string().max(200), role: z.enum(["CONTENT_EDITOR", "ADMIN"]) });
const updateSchema = z.object({ id: z.string().uuid(), role: z.enum(["CONTENT_EDITOR", "ADMIN"]), status: z.enum(["ACTIVE", "DISABLED"]) });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const admin = await requireAdminApi(request, true);
  if (admin instanceof NextResponse) return admin;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "담당자 정보를 확인해 주세요." }, { status: 400 });
  const passwordError = validateAdminPassword(parsed.data.password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  try {
    const user = await createStaffUser({ ...parsed.data, passwordHash: await hashPassword(parsed.data.password) });
    await writeAuditLog({ actorId: admin.id, action: "STAFF_CREATED", entityType: "user", entityId: user.id, summary: { role: user.role } });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const admin = await requireAdminApi(request, true);
  if (admin instanceof NextResponse) return admin;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.id === admin.id) return NextResponse.json({ error: "담당자 변경 내용을 확인해 주세요." }, { status: 400 });
  const user = await updateStaffUser(parsed.data);
  if (!user) return NextResponse.json({ error: "최고 관리자는 이 화면에서 변경할 수 없습니다." }, { status: 409 });
  await writeAuditLog({ actorId: admin.id, action: "STAFF_UPDATED", entityType: "user", entityId: user.id, summary: { role: user.role, status: user.status } });
  return NextResponse.json({ user });
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi(request, true);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ users: await listStaffUsers() });
}
