export const STORE_POLICY = {
  version: "DEMO-2026-08",
  effectiveAt: "2026-08-17",
  demoNotice: "정석몰의 상품·고객·재고는 모두 가상 데이터이며 토스페이먼츠 테스트 결제만 사용합니다.",
  sections: [
    { id: "shipping", title: "배송", body: "주문 금액 50,000원 이상은 무료, 미만은 3,000원으로 계산합니다. 강의용 데모이므로 실제 상품 발송은 발생하지 않습니다." },
    { id: "exchange", title: "교환·반품", body: "가상 상품이라 실제 교환·반품은 발생하지 않습니다. 일반적인 전자상거래 청약철회 조건을 시연 데이터로 설명할 뿐 법률·상거래 약관을 대신하지 않습니다." },
    { id: "refund", title: "테스트 결제 취소", body: "승인된 테스트 결제는 관리자 주문 화면에서 사유와 멱등 키를 포함해 전액 취소합니다. 부분 취소와 실결제 환불은 지원하지 않습니다." },
    { id: "privacy", title: "데이터", body: "실제 개인정보와 결제정보를 입력하지 마세요. 공개 데모 계정과 가상 주문·배송 정보만 사용합니다." },
  ],
} as const;

export function policyAnswer(query: string) {
  const terms = query.toLowerCase();
  const selected = new Set<string>();
  if (/배송|택배|배송비/.test(terms)) selected.add("shipping");
  if (/교환|반품/.test(terms)) selected.add("exchange");
  if (/환불|취소/.test(terms)) selected.add("refund");
  if (/개인정보|데이터/.test(terms)) selected.add("privacy");
  const matches = selected.size ? STORE_POLICY.sections.filter((section) => selected.has(section.id)) : STORE_POLICY.sections;
  return `${matches.map((section) => `${section.title}: ${section.body}`).join("\n")}\n정책 버전: ${STORE_POLICY.version}.`;
}
