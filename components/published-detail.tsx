import type { DetailPageVersion } from "@/lib/types";

export function PublishedDetail({ detail }: { detail: DetailPageVersion }) {
  return <section className="published-detail" aria-label="승인된 상품 상세페이지">
    <header><span className="kicker">PUBLISHED DETAIL · VERSION {detail.version}</span><h2>{detail.title}</h2><p>{detail.seoDescription}</p></header>
    {detail.blocks.map((block, index) => <section className={`published-block ${block.type}`} key={block.id}>
      <span>{String(index + 1).padStart(2, "0")} · {block.eyebrow ?? block.type.toUpperCase()}</span>
      <h3>{block.title}</h3>
      {block.body && <p>{block.body}</p>}
      {block.items && <div>{block.items.map((item) => <article key={`${block.id}-${item.title}`}><strong>{item.title}</strong><p>{item.body}</p></article>)}</div>}
      <small>{block.factIds.length ? `근거 ${block.factIds.length}건 연결` : "관리자 검토 완료"}</small>
    </section>)}
  </section>;
}
