import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { ArrowIcon, CheckIcon, SparkIcon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";
import { formatWon } from "@/lib/format";
import { getProductBySlug, getProductFacts, listProducts } from "@/lib/db/products";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const facts = await getProductFacts(product.id);
  const related = (await listProducts({ category: product.category })).filter((item) => item.id !== product.id).slice(0, 3);

  return <main className="detail-page">
    <div className="breadcrumb"><Link href="/products">SHOP</Link><span>/</span><Link href={`/products?category=${product.category}`}>{product.category}</Link><span>/</span><strong>{product.name}</strong></div>
    <section className="product-detail-hero">
      <div className="detail-gallery"><ProductArt product={product} /><div className="gallery-thumbs"><button className="active">01</button><button>02</button><button>03</button></div></div>
      <div className="detail-buybox">
        <span className="kicker">{product.category} / JEONGSEOK OBJECT {product.id.slice(-2).toUpperCase()}</span>
        <h1>{product.name}</h1>
        <p className="detail-summary">{product.shortDescription}</p>
        <div className="detail-price"><strong>{formatWon(product.price)}</strong>{product.compareAtPrice && <del>{formatWon(product.compareAtPrice)}</del>}</div>
        <div className="detail-rule" />
        <p className="detail-description">{product.description}</p>
        <ul className="quick-facts">{facts.slice(0, 3).map((fact) => <li key={fact.id}><CheckIcon size={15} /><span><strong>{fact.value}</strong><small>{fact.evidence}</small></span></li>)}</ul>
        <label className="buy-option"><span>수량</span><select defaultValue="1"><option>1</option><option>2</option><option>3</option></select></label>
        <AddToCart product={product} />
        <div className="buy-notes"><span>무료배송</span><span>테스트 결제 전용</span><span>가상 상품</span></div>
      </div>
    </section>

    <section className="detail-content-intro">
      <span className="kicker">DETAIL PAGE / APPROVAL READY</span>
      <h2>정돈은 더 많은 물건이 아니라<br /><em>자리의 기준</em>에서 시작됩니다.</h2>
      <p>{product.description} 상세페이지 자동생성 기능이 활성화되면 상품 팩트와 근거가 연결된 승인 버전이 이 영역에 게시됩니다.</p>
    </section>

    <section className="fact-band">
      <div><SparkIcon /><span>FACT-GROUNDED CONTENT</span></div>
      <div className="fact-band-items">{facts.length ? facts.map((fact) => <article key={fact.id}><span>{fact.key.toUpperCase()}</span><strong>{fact.value}</strong><small>{fact.evidence}</small></article>) : <article><span>CONTENT STATE</span><strong>기본 상품 정보</strong><small>콘텐츠 스튜디오 생성 전</small></article>}</div>
      <Link href="/admin/content">콘텐츠 스튜디오에서 생성 <ArrowIcon /></Link>
    </section>

    <section className="section-shell related-section"><div className="section-heading"><div><span className="kicker">COMPLETE THE SET</span><h2>함께 쓰는 정석</h2></div><Link href={`/products?category=${product.category}`}>같은 카테고리 <ArrowIcon /></Link></div><div className="product-grid">{related.map((item, index) => <ProductCard product={item} index={index} key={item.id} />)}</div></section>
  </main>;
}
