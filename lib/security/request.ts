import { NextRequest } from "next/server";

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const requestProtocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    return originUrl.host === requestHost && originUrl.protocol.replace(":", "") === requestProtocol;
  } catch {
    return false;
  }
}

export function hasAdminRequestHeader(request: NextRequest): boolean {
  return request.headers.get("x-jeongseok-request") === "1";
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function allowAttempt(key: string, limit = 8, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function requestFingerprint(request: NextRequest, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${scope}:${forwarded ?? "local"}`;
}
