import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { updateSupportTicketStatus } from "@/lib/db/admin";
import { writeAuditLog } from "@/lib/db/audit";
import { hasAdminRequestHeader, isSameOrigin } from "@/lib/security/request";

const schema = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const admin = await requireAdminApi(request);
  if (admin instanceof NextResponse) return admin;
  if (!["ADMIN", "SUPER_ADMIN"].includes(admin.role)) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "문의 상태를 확인해 주세요." }, { status: 400 });
  const ticket = await updateSupportTicketStatus((await params).id, parsed.data.status);
  if (!ticket) return NextResponse.json({ error: "문의 티켓을 찾지 못했습니다." }, { status: 404 });
  await writeAuditLog({ actorId: admin.id, action: "SUPPORT_TICKET_STATUS_CHANGED", entityType: "support_ticket", entityId: ticket.id, summary: { status: ticket.status } });
  return NextResponse.json({ ok: true, ticket });
}
