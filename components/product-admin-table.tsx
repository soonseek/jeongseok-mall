"use client";

import { FormEvent, useState } from "react";
import type { AdminProductRow } from "@/lib/db/admin";
import { formatWon } from "@/lib/format";

export function ProductAdminTable({ initial }: { initial: AdminProductRow[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>, item: AdminProductRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { id: item.id, name: form.get("name"), shortDescription: form.get("shortDescription"), price: Number(form.get("price")), stock: Number(form.get("stock")), status: form.get("status"), featured: form.get("featured") === "on" };
    const response = await fetch("/api/admin/products", { method: "PUT", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: String(payload.name), short_description: String(payload.shortDescription), price: payload.price, stock: payload.stock, status: String(payload.status), featured: payload.featured } : entry));
    setEditing(null); setMessage("상품 변경사항을 저장했습니다.");
  }

  return <section className="admin-data-panel">
    <div className="admin-table-head"><span>상품명</span><span>분류</span><span>가격</span><span>재고</span><span>상태</span><span /></div>
    {items.map((item) => <div key={item.id} className="admin-product-row">
      <div><strong>{item.name}</strong><small>{item.short_description}</small></div><span>{item.category}</span><strong>{formatWon(item.price)}</strong><span>{item.stock}</span><b className={`status-badge ${item.status === "PUBLISHED" ? "ready" : "unconfigured"}`}>{item.status}</b><button onClick={() => setEditing(editing === item.id ? null : item.id)}>{editing === item.id ? "닫기" : "수정"}</button>
      {editing === item.id && <form className="product-edit-form" onSubmit={(event) => save(event, item)}><label><span>상품명</span><input name="name" defaultValue={item.name} required /></label><label className="wide"><span>한 줄 설명</span><input name="shortDescription" defaultValue={item.short_description} required /></label><label><span>가격</span><input name="price" type="number" min="0" defaultValue={item.price} required /></label><label><span>재고</span><input name="stock" type="number" min="0" defaultValue={item.stock} required /></label><label><span>상태</span><select name="status" defaultValue={item.status}><option value="PUBLISHED">판매 중</option><option value="DRAFT">초안</option><option value="HIDDEN">숨김</option></select></label><label className="checkbox-label"><input name="featured" type="checkbox" defaultChecked={item.featured} /><span>대표 상품</span></label><button className="admin-primary-button">변경 저장</button></form>}
    </div>)}
    {message && <div className="admin-toast">{message}</div>}
  </section>;
}
