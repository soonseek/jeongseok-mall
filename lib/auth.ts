import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { getAdminBySession, getCustomerBySession, type AdminUser, type CustomerUser } from "@/lib/db/auth";

export const ADMIN_SESSION_COOKIE = "jeongseok_admin";
export const CUSTOMER_SESSION_COOKIE = "jeongseok_customer";

export async function currentAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return token ? getAdminBySession(token) : null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") redirect("/admin?denied=1");
  return admin;
}

export async function requireManager(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) redirect("/admin/content?denied=1");
  return admin;
}

export async function requireAdminApi(request: NextRequest, superAdmin = false): Promise<AdminUser | NextResponse> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const admin = token ? await getAdminBySession(token) : null;
  if (!admin) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (superAdmin && admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "최고 관리자 권한이 필요합니다." }, { status: 403 });
  }
  return admin;
}

export async function currentCustomer(): Promise<CustomerUser | null> {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  return token ? getCustomerBySession(token) : null;
}

export async function customerFromRequest(request: NextRequest): Promise<CustomerUser | null> {
  const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  return token ? getCustomerBySession(token) : null;
}

export async function requireCustomer(): Promise<CustomerUser> {
  const customer = await currentCustomer();
  if (!customer) redirect("/account");
  return customer;
}

export function setAdminCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearAdminCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function setCustomerCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearCustomerCookie(response: NextResponse): void {
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
