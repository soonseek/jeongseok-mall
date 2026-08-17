import type { ClaimReportItem, DetailBlock, Product } from "@/lib/types";

export type ProductFact = { id: string; key: string; value: string; evidence: string };

export type ShortSceneDraft = {
  scene: number;
  startSeconds: number;
  duration: number;
  voice: string;
  onScreen: string;
  visual: string;
  shotType: "PROBLEM" | "MASTER_PRODUCT" | "USE" | "FACT" | "RESULT" | "CTA";
  transition: "CUT" | "MATCH_CUT" | "PUSH" | "HOLD";
  factIds: string[];
};

const categoryProblem: Record<Product["category"], string> = {
  DESK: "책상 위가 자꾸 흐트러지면 일의 시작도 같이 늦어집니다.",
  MOBILE: "필요할 때마다 충전기와 거치 위치를 다시 찾고 있지는 않나요?",
  FOCUS: "집중하려는 순간마다 시작 방법부터 다시 정하고 있지는 않나요?",
  TRAVEL: "이동할 때마다 필요한 도구를 가방 안에서 다시 찾고 있지는 않나요?",
};

const categoryResult: Record<Product["category"], string> = {
  DESK: "손이 가는 자리를 먼저 정리해 두세요.",
  MOBILE: "자주 쓰는 기기의 자리를 하나로 정리해 보세요.",
  FOCUS: "집중은 의지보다 시작하기 쉬운 환경에서 먼저 만들어집니다.",
  TRAVEL: "꺼내는 순서까지 정리하면 이동 중 준비가 단순해집니다.",
};

function productSource(product: Product, field: "description" | "shortDescription" | "price") {
  return `product:${product.id}:${field}`;
}

function primaryFact(product: Product, facts: ProductFact[]) {
  return facts[0] ?? {
    id: productSource(product, "description"),
    key: "description",
    value: product.description,
    evidence: "관리자 승인 상품 설명",
  };
}

export function buildLocalDetailDraft(product: Product, facts: ProductFact[]): {
  title: string;
  seoTitle: string;
  seoDescription: string;
  blocks: DetailBlock[];
  claimReport: ClaimReportItem[];
  generationManifest: Record<string, unknown>;
} {
  const fact = primaryFact(product, facts);
  const featureItems = facts.length > 0
    ? facts.slice(0, 4).map((item) => ({ title: item.key, body: item.value, factIds: [item.id] }))
    : [{ title: "제품 구성", body: product.description, factIds: [productSource(product, "description")] }];
  const blocks: DetailBlock[] = [
    {
      id: "hero",
      type: "hero",
      eyebrow: product.category,
      title: product.name,
      body: product.shortDescription,
      factIds: [productSource(product, "shortDescription")],
    },
    {
      id: "problem",
      type: "problem",
      eyebrow: "BEFORE",
      title: categoryProblem[product.category],
      body: "거창한 변화보다 매일 반복되는 작은 동작부터 줄이는 제품입니다.",
      factIds: [],
    },
    {
      id: "features",
      type: "features",
      eyebrow: "PRODUCT FACTS",
      title: "확인된 정보만 간단하게 정리했습니다.",
      items: featureItems,
      factIds: featureItems.flatMap((item) => item.factIds),
    },
    {
      id: "proof",
      type: "proof",
      eyebrow: "EVIDENCE",
      title: fact.value,
      body: `근거: ${fact.evidence}`,
      factIds: [fact.id],
    },
    {
      id: "recommendation",
      type: "recommendation",
      eyebrow: "AFTER",
      title: categoryResult[product.category],
      body: product.description,
      factIds: [productSource(product, "description")],
    },
    {
      id: "cta",
      type: "cta",
      eyebrow: "JEONGSEOK MALL",
      title: `${product.name}을 자세히 확인해 보세요.`,
      body: `${product.price.toLocaleString("ko-KR")}원`,
      factIds: [productSource(product, "price")],
    },
  ];
  const claimReport: ClaimReportItem[] = blocks.flatMap((block) => {
    const claims = [block.title, block.body].filter(Boolean) as string[];
    return claims.map((text) => ({
      text,
      status: block.factIds.length > 0 ? "SUPPORTED" as const : "REVIEW_REQUIRED" as const,
      factIds: block.factIds,
    }));
  });
  return {
    title: `${product.name} 상세페이지`,
    seoTitle: `${product.name} | 정석몰`,
    seoDescription: product.shortDescription,
    blocks,
    claimReport,
    generationManifest: {
      engine: "JEONGSEOK_LOCAL_FACT_ENGINE",
      engineVersion: "1.0.0",
      externalDataTransfer: false,
      sourceFactIds: facts.map((item) => item.id),
      sourceProductUpdatedAt: product.updatedAt,
    },
  };
}

function makeHooks(product: Product, angle: string, fact: ProductFact): string[] {
  return [
    `${categoryProblem[product.category].replace(" 있지는 않나요?", " 있다면")}`,
    `${product.name}, ${fact.value}부터 확인하세요.`,
    `${angle}을 바꾸는 가장 작은 도구`,
  ];
}

export function buildLocalShortDraft(product: Product, facts: ProductFact[], durationSeconds: 15 | 30, angle: string): {
  hooks: string[];
  selectedHook: string;
  script: ShortSceneDraft[];
  manifest: Record<string, unknown>;
} {
  const fact = primaryFact(product, facts);
  const hooks = makeHooks(product, angle, fact);
  const common = {
    problemFactIds: [] as string[],
    productFactIds: [productSource(product, "description")],
    specFactIds: [fact.id],
    priceFactIds: [productSource(product, "price")],
  };
  const script: ShortSceneDraft[] = durationSeconds === 15 ? [
    { scene: 1, startSeconds: 0, duration: 2, voice: categoryProblem[product.category], onScreen: hooks[0], visual: "실제 사용 환경의 불편을 한 장면으로 보여준다. 제품은 아직 노출하지 않는다.", shotType: "PROBLEM", transition: "CUT", factIds: common.problemFactIds },
    { scene: 2, startSeconds: 2, duration: 3, voice: `${product.name}은 ${product.shortDescription}입니다.`, onScreen: product.name, visual: "승인된 제품 원본을 중앙에 고정하고 배경만 움직인다.", shotType: "MASTER_PRODUCT", transition: "PUSH", factIds: common.productFactIds },
    { scene: 3, startSeconds: 5, duration: 4, voice: product.description, onScreen: product.shortDescription, visual: "제품을 실제 용도에 맞게 사용하는 손의 동작을 2개 샷으로 보여준다.", shotType: "USE", transition: "MATCH_CUT", factIds: common.productFactIds },
    { scene: 4, startSeconds: 9, duration: 3, voice: `${fact.value}. 확인된 제품 정보입니다.`, onScreen: fact.value, visual: "제품 원본 위에 검증된 스펙을 코드 기반 텍스트로 표시한다.", shotType: "FACT", transition: "HOLD", factIds: common.specFactIds },
    { scene: 5, startSeconds: 12, duration: 3, voice: `${product.name}, 정석몰에서 확인해 보세요.`, onScreen: `${product.price.toLocaleString("ko-KR")}원 · 자세히 보기`, visual: "정리된 사용 후 환경과 제품을 함께 보여주고 CTA를 코드 레이어로 표시한다.", shotType: "CTA", transition: "HOLD", factIds: common.priceFactIds },
  ] : [
    { scene: 1, startSeconds: 0, duration: 3, voice: categoryProblem[product.category], onScreen: hooks[0], visual: "불편이 반복되는 실제 환경을 클로즈업한다.", shotType: "PROBLEM", transition: "CUT", factIds: common.problemFactIds },
    { scene: 2, startSeconds: 3, duration: 4, voice: "물건 하나를 더 놓는 게 아니라, 반복되는 동작 하나를 줄이는 겁니다.", onScreen: "반복 동작 하나 줄이기", visual: "같은 동작이 반복되는 장면을 2개 멀티샷으로 보여준다.", shotType: "PROBLEM", transition: "MATCH_CUT", factIds: [] },
    { scene: 3, startSeconds: 7, duration: 4, voice: `${product.name}은 ${product.shortDescription}입니다.`, onScreen: product.name, visual: "승인된 제품 원본을 마스터 프레임으로 소개한다.", shotType: "MASTER_PRODUCT", transition: "PUSH", factIds: common.productFactIds },
    { scene: 4, startSeconds: 11, duration: 5, voice: product.description, onScreen: product.shortDescription, visual: "제품 사용 과정을 시작·종료 프레임을 고정한 2개 샷으로 보여준다.", shotType: "USE", transition: "MATCH_CUT", factIds: common.productFactIds },
    { scene: 5, startSeconds: 16, duration: 4, voice: `${fact.value}. 이 정보는 제품 자료에서 확인했습니다.`, onScreen: fact.value, visual: "실제 제품 이미지 옆에 검증된 사실과 근거를 코드 레이어로 표시한다.", shotType: "FACT", transition: "HOLD", factIds: common.specFactIds },
    { scene: 6, startSeconds: 20, duration: 5, voice: categoryResult[product.category], onScreen: categoryResult[product.category], visual: "사용 전과 사용 후 환경을 좌우 비교로 보여준다.", shotType: "RESULT", transition: "MATCH_CUT", factIds: [] },
    { scene: 7, startSeconds: 25, duration: 5, voice: `${product.name}, 정석몰에서 자세히 확인해 보세요.`, onScreen: `${product.price.toLocaleString("ko-KR")}원 · 자세히 보기`, visual: "제품 마스터 프레임과 CTA를 표시하고 1초간 유지한다.", shotType: "CTA", transition: "HOLD", factIds: common.priceFactIds },
  ];
  return {
    hooks,
    selectedHook: hooks[0],
    script,
    manifest: {
      engine: "JEONGSEOK_LOCAL_SHORT_ENGINE",
      engineVersion: "1.0.0",
      externalDataTransfer: false,
      durationSeconds,
      masterAssetRequired: true,
      approvalGateRequiredBeforeExternalGeneration: true,
      sourceFactIds: facts.map((item) => item.id),
    },
  };
}

