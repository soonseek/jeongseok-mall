import { NextRequest, NextResponse } from "next/server";
import { clearCustomerCookie, CUSTOMER_SESSION_COOKIE } from "@/lib/auth";
import { deleteSession } from "@/lib/db/auth";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  const response = NextResponse.json({ ok: true });
  clearCustomerCookie(response);
  return response;
}
