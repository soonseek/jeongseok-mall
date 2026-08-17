"use client";

import { FormEvent, useState } from "react";
import type { AdminProductRow } from "@/lib/db/admin";
import { formatWon } from "@/lib/format";

function factsText(facts: AdminProductRow["facts"]) {
  return facts.map((fact) => `${fact.key} | ${fact.value} | ${fact.evidence}`).join("\n");
}

function payload(form: FormData) {
  const compareAt = String(form.get("compareAtPrice") ?? "").trim();
  const facts = String(form.get("facts") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [key, value, ...evidence] = line.split("|").map((part) => part.trim());
    return { key, value, evidence: evidence.join(" | ") };
  });
  return {
    slug: String(form.get("slug")), name: String(form.get("name")), category: String(form.get("category")),
    shortDescription: String(form.get("shortDescription")), description: String(form.get("description")),
    price: Number(form.get("price")), compareAtPrice: compareAt ? Number(compareAt) : null, stock: Number(form.get("stock")),
    status: String(form.get("status")), featured: form.get("featured") === "on", accent: String(form.get("accent")), facts,
  };
}

function ProductFormFields({ item }: { item?: AdminProductRow }) {
  return <>
    <label><span>상품명</span><input name="name" defaultValue={item?.name} required /></label>
    <label><span>상품 URL 슬러그</span><input name="slug" defaultValue={item?.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
    <label><span>분류</span><select name="category" defaultValue={item?.category ?? "DESK"}><option>DESK</option><option>MOBILE</option><option>FOCUS</option><option>TRAVEL</option></select></label>
    <label className="wide"><span>한 줄 설명</span><input name="shortDescription" defaultValue={item?.short_description} required /></label>
    <label className="full"><span>상품 설명</span><textarea name="description" defaultValue={item?.description} required /></label>
    <label><span>가격</span><input name="price" type="number" min="0" defaultValue={item?.price ?? 0} required /></label>
    <label><span>비교 가격</span><input name="compareAtPrice" type="number" min="0" defaultValue={item?.compare_at_price ?? ""} /></label>
    <label><span>재고</span><input name="stock" type="number" min="0" defaultValue={item?.stock ?? 0} required /></label>
    <label><span>상태</span><select name="status" defaultValue={item?.status ?? "DRAFT"}><option value="PUBLISHED">판매 중</option><option value="DRAFT">초안</option><option value="HIDDEN">숨김</option></select></label>
    <label><span>강조 색상</span><input name="accent" type="color" defaultValue={item?.accent ?? "#0047ff"} /></label>
    <label className="checkbox-label"><input name="featured" type="checkbox" defaultChecked={item?.featured} /><span>대표 상품</span></label>
    <label className="full"><span>검증 팩트 · 한 줄마다 key | 값 | 근거</span><textarea name="facts" defaultValue={item ? factsText(item.facts) : ""} placeholder="size | 900 × 400mm | 제품 규격서 v1" /></label>
  </>;
}

export function ProductAdminTable({ initial }: { initial: AdminProductRow[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>, item: AdminProductRow) {
    event.preventDefault(); setPending(true); setMessage("");
    const body = { id: item.id, ...payload(new FormData(event.currentTarget)) };
    const response = await fetch("/api/admin/products", { method: "PUT", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? "상품을 저장하지 못했습니다.");
    else { setItems((current) => current.map((entry) => entry.id === item.id ? result.product : entry)); setEditing(null); setMessage("상품과 팩트 원장을 저장했습니다."); }
    setPending(false);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const response = await fetch("/api/admin/products", { method: "POST", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify(payload(new FormData(event.currentTarget))) });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? "상품을 만들지 못했습니다.");
    else { setItems((current) => [result.product, ...current]); setCreating(false); setMessage("새 상품을 만들었습니다. 콘텐츠 스튜디오에서 상세페이지를 생성할 수 있습니다."); }
    setPending(false);
  }

  return <>
    <div className="admin-list-toolbar"><button className="admin-primary-button" onClick={() => setCreating((value) => !value)}>{creating ? "등록 닫기" : "+ 새 상품 등록"}</button></div>
    {creating && <form className="product-create-form" onSubmit={create}><ProductFormFields /><button className="admin-primary-button" disabled={pending}>{pending ? "저장 중…" : "상품 등록"}</button></form>}
    <section className="admin-data-panel">
      <div className="admin-table-head"><span>상품명</span><span>분류</span><span>가격</span><span>재고</span><span>상태</span><span /></div>
      {items.map((item) => <div key={item.id} className="admin-product-row">
        <div><strong>{item.name}</strong><small>{item.short_description}</small></div><span>{item.category}</span><strong>{formatWon(item.price)}</strong><span>{item.stock}</span><b className={`status-badge ${item.status === "PUBLISHED" ? "ready" : "unconfigured"}`}>{item.status}</b><button onClick={() => setEditing(editing === item.id ? null : item.id)}>{editing === item.id ? "닫기" : "수정"}</button>
        {editing === item.id && <form className="product-edit-form" onSubmit={(event) => save(event, item)}><ProductFormFields item={item} /><button className="admin-primary-button" disabled={pending}>{pending ? "저장 중…" : "변경 저장"}</button></form>}
      </div>)}
      {message && <div className="admin-toast" role="status">{message}</div>}
    </section>
  </>;
}
