import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setCustomerCookie } from "@/lib/auth";
import { createSession, ensureDemoCustomer, findCustomerForLogin, purgeExpiredSessions } from "@/lib/db/auth";
import { verifyPassword } from "@/lib/security/password";
import { allowAttempt, hasAdminRequestHeader, isSameOrigin, requestFingerprint } from "@/lib/security/request";

const schema = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  if (!allowAttempt(requestFingerprint(request, "customer-login"), 12)) {
    return NextResponse.json({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "이메일과 비밀번호를 확인해 주세요." }, { status: 400 });
  await ensureDemoCustomer();
  const customer = await findCustomerForLogin(parsed.data.email);
  const passwordMatches = customer ? await verifyPassword(parsed.data.password, customer.password_hash) : false;
  if (!customer || customer.status !== "ACTIVE" || !passwordMatches) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await purgeExpiredSessions();
  const session = await createSession(customer.id);
  const response = NextResponse.json({ ok: true });
  setCustomerCookie(response, session.token, session.expiresAt);
  return response;
}
