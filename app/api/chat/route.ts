import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai";
import { catalogForAgent, fallbackAnswer, rankCatalog } from "@/lib/agent/catalog";
import { createSupportTicket, finishAgentRun, getOrCreateConversation, getOwnOrderStatus, recentMessages, recordAgentTool, saveMessage, startAgentRun } from "@/lib/db/chat";
import { customerFromRequest } from "@/lib/auth";
import { policyAnswer, STORE_POLICY } from "@/lib/store-policy";
import { allowAttempt, hasAdminRequestHeader, isSameOrigin, requestFingerprint } from "@/lib/security/request";

const chatSchema = z.object({ message: z.string().trim().min(2).max(1000), conversationId: z.string().uuid().optional(), sessionKey: z.string().uuid() });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  if (!allowAttempt(requestFingerprint(request, "chat"), 40, 10 * 60 * 1000)) return NextResponse.json({ error: "잠시 후 다시 질문해 주세요." }, { status: 429 });
  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "질문을 두 글자 이상 입력해 주세요." }, { status: 400 });

  const startedAt = Date.now();
  const customer = await customerFromRequest(request);
  const conversationId = await getOrCreateConversation({ ...parsed.data, userId: customer?.id });
  await saveMessage(conversationId, "USER", parsed.data.message);
  const configured = await getOpenAI();
  const runId = await startAgentRun(conversationId, configured ? "OPENAI" : "LOCAL", configured?.model ?? "catalog-fallback");

  try {
    let answer: string;
    let products: Array<{ id: string; slug: string; name: string; price: number }> = [];
    let usage: { input_tokens?: number; output_tokens?: number } | undefined;
    const orderNumber = parsed.data.message.match(/JS-[A-Z0-9-]+/i)?.[0].toUpperCase();
    const wantsOrder = /(내\s*)?주문|결제\s*상태|배송\s*상태/.test(parsed.data.message);
    const wantsTicket = /상담원|문의\s*접수|티켓|이관해/.test(parsed.data.message);
    const wantsPolicy = /배송|교환|환불|반품/.test(parsed.data.message) && !wantsOrder;

    if (wantsOrder) {
      if (!customer) {
        await recordAgentTool(runId, "get_my_order_status", { orderNumber }, { rejected: true, reason: "LOGIN_REQUIRED" });
        answer = "본인 주문은 고객 로그인 후에만 확인할 수 있습니다. 상단의 내 계정에서 데모 계정으로 로그인한 뒤 다시 물어보세요.";
      } else {
        const order = await getOwnOrderStatus(customer.id, orderNumber);
        await recordAgentTool(runId, "get_my_order_status", { orderNumber }, { found: Boolean(order), orderId: order?.id, status: order?.status });
        answer = order
          ? `본인 주문 ${order.order_number}은 현재 ${order.status} 상태입니다. 결제 상태는 ${order.payment_status ?? "READY"}이고, 주문 금액은 ${order.total_amount.toLocaleString("ko-KR")}원입니다. 내 계정에서 상세 내역을 보실 수 있습니다.`
          : "로그인한 계정에서 확인할 수 있는 주문이 없습니다. 다른 고객의 주문은 조회할 수 없습니다.";
      }
    } else if (wantsTicket) {
      const ticketId = await createSupportTicket({ conversationId, userId: customer?.id, subject: "정석 상담 이관 요청", summary: parsed.data.message });
      await recordAgentTool(runId, "create_support_ticket", { confirmedByMessage: true }, { ticketId });
      answer = `상담 티켓 ${ticketId.slice(0, 8).toUpperCase()}를 접수했습니다. 관리자 상담 관제 화면에서 확인할 수 있습니다.`;
    } else if (wantsPolicy) {
      await recordAgentTool(runId, "get_store_policy", { query: parsed.data.message }, { policyVersion: STORE_POLICY.version });
      answer = policyAnswer(parsed.data.message);
    } else {
      const catalog = await catalogForAgent();
      const matches = rankCatalog(catalog, parsed.data.message);
      products = matches.slice(0, 3).map((item) => ({ id: item.id, slug: item.slug, name: item.name, price: item.price }));
      await recordAgentTool(runId, "search_products", { query: parsed.data.message }, { productIds: matches.map((item) => item.id), resultCount: matches.length });
      if (configured) {
        const history = await recentMessages(conversationId);
        const response = await configured.client.responses.create({
          model: configured.model,
          store: false,
          instructions: `당신은 정석몰의 상품 상담 에이전트입니다. 제공된 카탈로그와 검증된 팩트 안에서만 답하세요. 없는 성능이나 할인, 배송 조건을 만들지 마세요. 최대 세 개만 추천하세요.\n\n[현재 카탈로그]\n${JSON.stringify(catalog)}`,
          input: history.map((message) => ({ role: message.role === "USER" ? "user" as const : "assistant" as const, content: message.content })),
        });
        answer = response.output_text || fallbackAnswer(matches, parsed.data.message);
        usage = response.usage ?? undefined;
      } else answer = fallbackAnswer(matches, parsed.data.message);
    }
    await saveMessage(conversationId, "ASSISTANT", answer, { recommendedProductIds: products.map((item) => item.id), source: configured ? "OPENAI" : "LOCAL" });
    await finishAgentRun(runId, { status: "COMPLETED", inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens, latencyMs: Date.now() - startedAt });
    return NextResponse.json({ conversationId, answer, products });
  } catch (error) {
    await finishAgentRun(runId, { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN", latencyMs: Date.now() - startedAt });
    return NextResponse.json({ error: "상담 AI 응답을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
