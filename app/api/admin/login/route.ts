import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, findUserForLogin, purgeExpiredSessions } from "@/lib/db/auth";
import { setAdminCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/security/password";
import { allowAttempt, hasAdminRequestHeader, isSameOrigin, requestFingerprint } from "@/lib/security/request";

const loginSchema = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  if (!allowAttempt(requestFingerprint(request, "admin-login"))) {
    return NextResponse.json({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "이메일과 비밀번호를 확인해 주세요." }, { status: 400 });

  const user = await findUserForLogin(parsed.data.email);
  const allowedRole = user && ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"].includes(user.role);
  const passwordMatches = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
  if (!user || !allowedRole || user.status !== "ACTIVE" || !passwordMatches) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await purgeExpiredSessions();
  const session = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, session.token, session.expiresAt);
  return response;
}
