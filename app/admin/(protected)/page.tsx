import Link from "next/link";
import { databaseMode, query } from "@/lib/db/client";

type CountRow = { products: number; orders: number; conversations: number; jobs: number };

export default async function AdminHomePage() {
  const [counts] = await query<CountRow>(`SELECT
    (SELECT count(*)::int FROM products) AS products,
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM conversations) AS conversations,
    (SELECT count(*)::int FROM jobs) AS jobs`);
  const mode = await databaseMode();
  return <>
    <header className="admin-page-header"><div><span>OVERVIEW</span><h1>전체 현황</h1><p>현재 시스템에서 실제로 움직이는 도메인과 작업 상태입니다.</p></div><Link href="/" target="_blank">쇼핑몰 보기 ↗</Link></header>
    <main className="admin-page-body">
      <section className="admin-metrics">
        <article><span>상품</span><strong>{counts?.products ?? 0}</strong><small>등록된 상품</small></article>
        <article><span>주문</span><strong>{counts?.orders ?? 0}</strong><small>누적 주문</small></article>
        <article><span>상담</span><strong>{counts?.conversations ?? 0}</strong><small>상담 대화</small></article>
        <article><span>작업</span><strong>{counts?.jobs ?? 0}</strong><small>자동화 작업</small></article>
      </section>
      <section className="admin-panel"><div><span>SYSTEM</span><h2>실행 환경</h2></div><dl className="admin-definition-list"><div><dt>데이터베이스</dt><dd>{mode === "pglite" ? "PGlite · 로컬 개발" : "PostgreSQL · 운영"}</dd></div><div><dt>결제</dt><dd>외부 연동에서 테스트 키 등록 필요</dd></div><div><dt>상담·콘텐츠 AI</dt><dd>외부 연동에서 공급자 키 등록 필요</dd></div></dl></section>
    </main>
  </>;
}
