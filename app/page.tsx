import Link from "next/link";
import { ArrowIcon, PlayIcon, SparkIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/db/products";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await listProducts({ featured: true });
  return <main>
    <section className="home-hero">
      <div className="hero-copy">
        <span className="kicker">JEONGSEOK / PRODUCTIVITY OBJECTS</span>
        <h1>일의 흐름을<br /><em>정돈하는 기준.</em></h1>
        <p>매일 손이 가는 도구부터 고릅니다.<br />과장 없이, 쓰임이 분명한 정석만.</p>
        <div className="hero-actions"><Link className="primary-button" href="/products">전체 상품 보기 <ArrowIcon /></Link><button className="text-button"><PlayIcon /> 정석몰이 만들어진 과정</button></div>
      </div>
      <div className="hero-visual" aria-label="정석몰 대표 상품 그래픽">
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="hero-object"><span>정석</span><small>01 / ESSENTIAL</small></div>
        <div className="hero-proof"><SparkIcon /><span>정석 콘텐츠 스튜디오 생성본</span></div>
      </div>
      <div className="hero-rail"><span>BUILD</span><span>CONSULT</span><span>PAY</span><span>CREATE</span><span>RENDER</span></div>
    </section>

    <section className="category-strip">
      <p>당신의 흐름은<br />어디에서 자주 끊기나요?</p>
      {[['DESK','책상 위 기준'],['MOBILE','이동하는 기준'],['FOCUS','집중의 기준'],['TRAVEL','가볍게 챙기는 기준']].map(([key, label], index) => <Link href={`/products?category=${key}`} key={key}><span>0{index + 1}</span><strong>{label}</strong><ArrowIcon /></Link>)}
    </section>

    <section className="section-shell product-section">
      <div className="section-heading"><div><span className="kicker">SELECTED OBJECTS</span><h2>지금 가장 많이<br />고르는 정석</h2></div><Link href="/products">12개 전체 보기 <ArrowIcon /></Link></div>
      <div className="product-grid">{products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div>
    </section>

    <section className="system-story">
      <div className="story-number">03</div>
      <div><span className="kicker">BUILT AS A REAL SYSTEM</span><h2>상품 하나가<br />판매 콘텐츠가 되는 과정.</h2></div>
      <div className="story-steps">
        <article><span>01</span><strong>FACT</strong><p>상품 팩트와 근거 자료를 한곳에 정리합니다.</p></article>
        <article><span>02</span><strong>DETAIL</strong><p>근거가 연결된 상세페이지를 생성하고 승인합니다.</p></article>
        <article><span>03</span><strong>SHORTS</strong><p>같은 팩트에서 세로형 소개 영상을 렌더링합니다.</p></article>
      </div>
      <Link className="light-button" href="/admin/content">정석 콘텐츠 스튜디오 보기 <ArrowIcon /></Link>
    </section>

    <footer className="site-footer"><div className="brand-lockup inverse"><strong>정석</strong><span>MALL</span></div><p>정석강의 1강을 위해 실제로 구축 중인 커머스·상담·콘텐츠 생산 시스템</p><Link href="/admin">ADMIN</Link></footer>
  </main>;
}
