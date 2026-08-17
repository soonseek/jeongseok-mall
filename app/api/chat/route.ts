import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai";
import { catalogForAgent, fallbackAnswer, rankCatalog } from "@/lib/agent/catalog";
import { finishAgentRun, getOrCreateConversation, recentMessages, recordAgentTool, saveMessage, startAgentRun } from "@/lib/db/chat";
import { allowAttempt, hasAdminRequestHeader, isSameOrigin, requestFingerprint } from "@/lib/security/request";

const chatSchema = z.object({ message: z.string().trim().min(2).max(1000), conversationId: z.string().uuid().optional(), sessionKey: z.string().uuid() });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || !hasAdminRequestHeader(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  if (!allowAttempt(requestFingerprint(request, "chat"), 40, 10 * 60 * 1000)) return NextResponse.json({ error: "잠시 후 다시 질문해 주세요." }, { status: 429 });
  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "질문을 두 글자 이상 입력해 주세요." }, { status: 400 });

  const startedAt = Date.now();
  const conversationId = await getOrCreateConversation(parsed.data);
  await saveMessage(conversationId, "USER", parsed.data.message);
  const catalog = await catalogForAgent();
  const matches = rankCatalog(catalog, parsed.data.message);
  const configured = await getOpenAI();
  const runId = await startAgentRun(conversationId, configured ? "OPENAI" : "LOCAL", configured?.model ?? "catalog-fallback");
  await recordAgentTool(runId, { query: parsed.data.message }, { productIds: matches.map((item) => item.id), resultCount: matches.length });

  try {
    let answer: string;
    let usage: { input_tokens?: number; output_tokens?: number } | undefined;
    if (configured) {
      const history = await recentMessages(conversationId);
      const response = await configured.client.responses.create({
        model: configured.model,
        store: false,
        instructions: `당신은 정석몰의 상품 상담 에이전트입니다. 제공된 카탈로그와 검증된 팩트 안에서만 답하세요. 없는 성능이나 할인, 배송 조건을 만들지 마세요. 먼저 결론을 짧게 말하고, 많아도 상품 세 개만 추천하세요. 비개발자도 이해할 쉬운 한국어를 쓰세요. 주문 개인정보는 이 채팅에서 요구하지 말고 주문 페이지로 안내하세요. 근거가 없으면 모른다고 말하고 상담 이관을 안내하세요.\n\n[현재 카탈로그]\n${JSON.stringify(catalog)}`,
        input: history.map((message) => ({ role: message.role === "USER" ? "user" as const : "assistant" as const, content: message.content })),
      });
      answer = response.output_text || fallbackAnswer(matches, parsed.data.message);
      usage = response.usage ?? undefined;
    } else answer = fallbackAnswer(matches, parsed.data.message);
    await saveMessage(conversationId, "ASSISTANT", answer, { recommendedProductIds: matches.map((item) => item.id), source: configured ? "OPENAI" : "LOCAL" });
    await finishAgentRun(runId, { status: "COMPLETED", inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens, latencyMs: Date.now() - startedAt });
    return NextResponse.json({ conversationId, answer, products: matches.slice(0, 3).map((item) => ({ id: item.id, slug: item.slug, name: item.name, price: item.price })) });
  } catch (error) {
    await finishAgentRun(runId, { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN", latencyMs: Date.now() - startedAt });
    return NextResponse.json({ error: "상담 AI 응답을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
