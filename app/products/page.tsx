import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/db/products";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const params = await searchParams;
  const category = params.category ?? "ALL";
  const products = await listProducts({ category, search: params.q });
  const filters = ["ALL", "DESK", "MOBILE", "FOCUS", "TRAVEL"];
  return <main className="catalog-page">
    <header className="catalog-hero"><span className="kicker">SHOP THE STANDARD</span><h1>도구가 바뀌면<br />일의 리듬이 바뀝니다.</h1><p>정석몰의 모든 상품은 가상의 실습 데이터입니다.<br />기능과 결제는 실제 시스템으로 작동합니다.</p></header>
    <div className="catalog-toolbar">
      <nav>{filters.map((filter) => <Link className={category === filter ? "active" : ""} href={filter === "ALL" ? "/products" : `/products?category=${filter}`} key={filter}>{filter}</Link>)}</nav>
      <form><input name="q" defaultValue={params.q} placeholder="상품 검색" />{category !== "ALL" && <input type="hidden" name="category" value={category} />}</form>
      <span>{products.length} OBJECTS</span>
    </div>
    <section className="section-shell catalog-products"><div className="product-grid">{products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div>{products.length === 0 && <div className="empty-state"><strong>조건에 맞는 상품이 없습니다.</strong><p>검색어나 카테고리를 바꿔보세요.</p></div>}</section>
  </main>;
}
