import Link from "next/link";

export default async function PaymentFailPage({ searchParams }: { searchParams: Promise<{ code?: string; message?: string; orderId?: string }> }) {
  const params = await searchParams;
  return <main className="result-page"><section><span className="kicker">PAYMENT CANCELED</span><h1>결제가 완료되지 않았습니다.</h1><p>{params.message ?? "결제를 취소했거나 인증 과정에서 문제가 발생했습니다."}</p>{params.code && <small>오류 코드 {params.code}</small>}<Link className="primary-button" href="/cart">장바구니로 돌아가기</Link></section></main>;
}
