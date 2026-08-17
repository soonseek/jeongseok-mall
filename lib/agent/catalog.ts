import { query } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";

export type CatalogItem = {
  id: string; slug: string; name: string; category: string; short_description: string;
  description: string; price: number; stock: number;
  facts: Array<{ key: string; value: string; evidence: string }>;
};

export async function catalogForAgent(): Promise<CatalogItem[]> {
  await seedDatabase();
  const products = await query<Omit<CatalogItem, "facts">>(
    `SELECT id, slug, name, category, short_description, description, price, stock
     FROM products WHERE status='PUBLISHED' ORDER BY featured DESC, name`,
  );
  const facts = await query<{ product_id: string; key: string; value: string; evidence: string }>(
    `SELECT product_id, fact_key AS key, fact_value AS value, evidence
     FROM product_facts WHERE status='VERIFIED' ORDER BY fact_key`,
  );
  return products.map((product) => ({ ...product, price: Number(product.price), stock: Number(product.stock), facts: facts.filter((fact) => fact.product_id === product.id).map(({ key, value, evidence }) => ({ key, value, evidence })) }));
}

export function rankCatalog(items: CatalogItem[], message: string): CatalogItem[] {
  const normalized = message.toLowerCase();
  const terms = normalized.split(/\s+/).filter((term) => term.length >= 2);
  const categoryHint = /재택|책상|데스크|업무/.test(normalized) ? "DESK"
    : /충전|휴대폰|모바일/.test(normalized) ? "MOBILE"
      : /집중|타이머|소음/.test(normalized) ? "FOCUS"
        : /여행|출장|이동/.test(normalized) ? "TRAVEL" : null;
  const budget = parseBudget(normalized);
  return items.map((item) => {
    const haystack = `${item.name} ${item.category} ${item.short_description} ${item.description} ${item.facts.map((fact) => `${fact.key} ${fact.value}`).join(" ")}`.toLowerCase();
    const lexicalScore = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    const categoryScore = categoryHint === item.category ? 4 : 0;
    const budgetScore = budget == null || item.price <= budget ? 1 : -10;
    return { item, score: lexicalScore + categoryScore + budgetScore };
  }).sort((a, b) => b.score - a.score || Number(b.item.stock > 0) - Number(a.item.stock > 0)).filter((entry) => entry.score > 0).slice(0, 4).map((entry) => entry.item);
}

function parseBudget(message: string): number | null {
  const manwon = message.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (manwon) return Math.round(Number(manwon[1]) * 10000);
  const won = message.match(/(\d[\d,]*)\s*원/);
  return won ? Number(won[1].replaceAll(",", "")) : null;
}

export function fallbackAnswer(matches: CatalogItem[], message: string): string {
  if (matches.length === 0) return "찾으시는 조건을 조금만 더 알려주세요. 어떤 환경에서 쓰는지, 예산은 어느 정도인지 말씀해주시면 현재 판매 중인 상품 안에서 다시 골라볼게요.";
  const budget = parseBudget(message);
  const selected: CatalogItem[] = [];
  let total = 0;
  for (const item of matches) {
    if (selected.length >= 3) break;
    if (budget == null || total + item.price <= budget) { selected.push(item); total += item.price; }
  }
  const finalItems = selected.length > 0 ? selected : matches.slice(0, 1);
  const lines = finalItems.map((item) => `• ${item.name} — ${item.short_description} (${item.price.toLocaleString("ko-KR")}원)`);
  const budgetLine = budget == null ? "" : `\n합계 ${total.toLocaleString("ko-KR")}원으로 말씀하신 예산 안입니다.\n`;
  return `현재 상품 가운데서는 이 조합부터 보시면 됩니다.\n\n${lines.join("\n")}${budgetLine}\n사용하는 노트북 크기나 책상 폭을 알려주시면 여기서 더 좁혀드릴게요.`;
}
