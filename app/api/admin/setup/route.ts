import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createFirstAdmin, createSession, hasAnyAdmin } from "@/lib/db/auth";
import { setAdminCookie } from "@/lib/auth";
import { hashPassword, validateAdminPassword } from "@/lib/security/password";
import { allowAttempt, hasAdminRequestHeader, isSameOrigin, requestFingerprint } from "@/lib/security/request";

const setupSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.email().max(200),
  password: z.string().max(200),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  if (!allowAttempt(requestFingerprint(request, "admin-setup"), 5)) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  if (await hasAnyAdmin()) {
    return NextResponse.json({ error: "최초 관리자 설정이 이미 완료되었습니다." }, { status: 409 });
  }

  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "입력값을 확인해 주세요." }, { status: 400 });
  const passwordError = validateAdminPassword(parsed.data.password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  try {
    const admin = await createFirstAdmin({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    });
    const session = await createSession(admin.id);
    const response = NextResponse.json({ ok: true });
    setAdminCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_ALREADY_EXISTS") {
      return NextResponse.json({ error: "최초 관리자 설정이 이미 완료되었습니다." }, { status: 409 });
    }
    throw error;
  }
}
