import { STORE_POLICY } from "@/lib/store-policy";

export default function PoliciesPage() {
  return <main><header className="simple-hero"><span className="kicker">STORE POLICY · {STORE_POLICY.version}</span><h1>배송·교환·취소 안내</h1><p>{STORE_POLICY.demoNotice}</p></header><section className="policy-grid">{STORE_POLICY.sections.map((section, index) => <article key={section.id}><span>{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2><p>{section.body}</p></article>)}</section></main>;
}
