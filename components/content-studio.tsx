"use client";

import { FormEvent, useState } from "react";
import type { ContentProductRow, DetailTransition } from "@/lib/db/content";
import type { DetailPageVersion, ShortProject } from "@/lib/types";

const transitionLabel: Record<DetailTransition, string> = {
  request_review: "검수 요청",
  approve: "승인",
  reject: "반려",
  publish: "정석몰에 게시",
};

export function ContentStudio({ initialProducts, initialDetails, initialShorts, canApprove }: {
  initialProducts: ContentProductRow[];
  initialDetails: DetailPageVersion[];
  initialShorts: ShortProject[];
  canApprove: boolean;
}) {
  const [products] = useState(initialProducts);
  const [details, setDetails] = useState(initialDetails);
  const [shorts, setShorts] = useState(initialShorts);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  function latestDetail(productId: string) {
    return details.filter((detail) => detail.productId === productId).sort((a, b) => b.version - a.version)[0];
  }

  async function createDetail(productId: string) {
    setPending(`detail:${productId}`); setMessage("");
    const response = await fetch("/api/admin/content/detail", { method: "POST", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify({ productId }) });
    const result = await response.json();
    if (response.ok) { setDetails((current) => [result.detail, ...current]); setMessage("팩트 기반 상세페이지 초안을 만들었습니다."); }
    else setMessage(result.error ?? "초안을 만들지 못했습니다.");
    setPending("");
  }

  async function transition(detail: DetailPageVersion, action: DetailTransition) {
    setPending(`detail:${detail.id}`); setMessage("");
    const response = await fetch(`/api/admin/content/detail/${detail.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-jeongseok-request": "1" }, body: JSON.stringify({ action }) });
    const result = await response.json();
    if (response.ok) {
      setDetails((current) => current.map((item) => item.id === detail.id ? result.detail : item));
      setMessage(`상세페이지를 ${transitionLabel[action]} 처리했습니다.`);
    } else setMessage(result.error ?? "상태를 변경하지 못했습니다.");
    setPending("");
  }

  async function saveDetail(event: FormEvent<HTMLFormElement>, detail: DetailPageVersion) {
    event.preventDefault();
    setPending(`detail:${detail.id}`); setMessage("");
    const form = new FormData(event.currentTarget);
    const blocks = detail.blocks.map((block) => ({
      ...block,
      title: String(form.get(`title:${block.id}`) ?? block.title),
      body: block.body === undefined ? undefined : String(form.get(`body:${block.id}`) ?? block.body),
    }));
    const response = await fetch(`/api/admin/content/detail/${detail.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-jeongseok-request": "1" },
      body: JSON.stringify({ action: "save_draft", title: form.get("title"), seoTitle: form.get("seoTitle"), seoDescription: form.get("seoDescription"), blocks }),
    });
    const result = await response.json();
    if (response.ok) { setDetails((current) => current.map((item) => item.id === detail.id ? result.detail : item)); setMessage("상세페이지 초안 수정사항을 저장했습니다."); }
    else setMessage(result.error ?? "상세페이지 초안을 저장하지 못했습니다.");
    setPending("");
  }

  async function createShort(event: FormEvent<HTMLFormElement>, productId: string, detailPageVersionId: string) {
    event.preventDefault();
    setPending(`short:${productId}`); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/content/short", {
      method: "POST",
      headers: { "content-type": "application/json", "x-jeongseok-request": "1" },
      body: JSON.stringify({ productId, detailPageVersionId, durationSeconds: Number(form.get("durationSeconds")), angle: String(form.get("angle")) }),
    });
    const result = await response.json();
    if (response.ok) { setShorts((current) => [result.short, ...current]); setMessage("훅 3안과 장면별 쇼츠 대본을 만들었습니다."); }
    else setMessage(result.error ?? "쇼츠 대본을 만들지 못했습니다.");
    setPending("");
  }

  async function renderShort(short: ShortProject) {
    setPending(`render:${short.id}`); setMessage("");
    const response = await fetch(`/api/admin/content/short/${short.id}/render`, { method: "POST", headers: { "x-jeongseok-request": "1" } });
    const result = await response.json();
    if (response.ok) { setShorts((current) => current.map((item) => item.id === short.id ? result.short : item)); setMessage("실제 MP4·SRT·썸네일 산출물을 만들었습니다."); }
    else setMessage(result.error ?? "쇼츠 렌더를 완료하지 못했습니다.");
    setPending("");
  }

  async function saveShort(event: FormEvent<HTMLFormElement>, short: ShortProject) {
    event.preventDefault();
    setPending(`short-edit:${short.id}`); setMessage("");
    const form = new FormData(event.currentTarget);
    const script = short.script.map((scene, index) => ({
      ...scene,
      voice: String(form.get(`voice:${index}`) ?? scene.voice),
      onScreen: String(form.get(`onScreen:${index}`) ?? scene.onScreen),
    }));
    const response = await fetch(`/api/admin/content/short/${short.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-jeongseok-request": "1" },
      body: JSON.stringify({ selectedHook: form.get("selectedHook"), script }),
    });
    const result = await response.json();
    if (response.ok) { setShorts((current) => current.map((item) => item.id === short.id ? result.short : item)); setMessage("훅과 장면별 대본을 저장했습니다."); }
    else setMessage(result.error ?? "쇼츠 대본을 저장하지 못했습니다.");
    setPending("");
  }

  return <div className="content-studio">
    <div className="admin-notice"><strong>사람 승인 전에는 자동 게시되지 않습니다.</strong><p>초안 생성 → 검수 요청 → 관리자 승인 → 게시 순서를 지킵니다.</p></div>
    <section className="content-product-list">{products.map((product) => {
      const detail = latestDetail(product.id);
      const productShorts = shorts.filter((short) => short.productId === product.id);
      const supportedClaims = detail?.claimReport.filter((claim) => claim.status === "SUPPORTED").length ?? 0;
      return <article className="content-product-card" key={product.id}>
        <header><div><span>{product.category}</span><h2>{product.name}</h2><small>{product.slug}</small></div><b className={`status-badge ${detail?.status === "PUBLISHED" ? "ready" : "unverified"}`}>{detail?.status ?? "NOT GENERATED"}</b></header>
        {!detail ? <button className="admin-primary-button" disabled={Boolean(pending)} onClick={() => createDetail(product.id)}>{pending === `detail:${product.id}` ? "초안 생성 중…" : "상세페이지 초안 생성"}</button> : <>
          <div className="content-metrics"><span>VERSION <b>v{detail.version}</b></span><span>FACT CLAIMS <b>{supportedClaims}/{detail.claimReport.length}</b></span><span>SHORTS <b>{productShorts.length}</b></span></div>
          <details className="content-preview"><summary>구조화 초안·팩트 보고서 미리보기</summary><div>{detail.blocks.map((block) => <section key={block.id}><span>{block.eyebrow ?? block.type}</span><h3>{block.title}</h3>{block.body && <p>{block.body}</p>}<small>FACTS: {block.factIds.join(", ") || "검토 필요"}</small></section>)}</div></details>
          {["DRAFT", "REJECTED"].includes(detail.status) && <details className="content-draft-editor"><summary>문장·SEO 초안 수정</summary><form onSubmit={(event) => saveDetail(event, detail)}>
            <label><span>상세페이지 제목</span><input name="title" defaultValue={detail.title} required /></label>
            <label><span>SEO 제목</span><input name="seoTitle" defaultValue={detail.seoTitle} required /></label>
            <label><span>SEO 설명</span><textarea name="seoDescription" defaultValue={detail.seoDescription} required /></label>
            {detail.blocks.map((block) => <fieldset key={block.id}><legend>{block.eyebrow ?? block.type}</legend><label><span>제목</span><input name={`title:${block.id}`} defaultValue={block.title} required /></label>{block.body !== undefined && <label><span>본문</span><textarea name={`body:${block.id}`} defaultValue={block.body} /></label>}<small>{block.factIds.length ? `근거 ${block.factIds.join(", ")}` : "근거 없음 · 검토 필요"}</small></fieldset>)}
            <button className="admin-primary-button" disabled={Boolean(pending)}>초안 저장</button>
          </form></details>}
          <div className="content-actions">
            {["DRAFT", "REJECTED"].includes(detail.status) && <button onClick={() => transition(detail, "request_review")} disabled={Boolean(pending)}>검수 요청</button>}
            {detail.status === "IN_REVIEW" && canApprove && <><button onClick={() => transition(detail, "approve")} disabled={Boolean(pending)}>승인</button><button className="danger" onClick={() => transition(detail, "reject")} disabled={Boolean(pending)}>반려</button></>}
            {detail.status === "APPROVED" && canApprove && <button onClick={() => transition(detail, "publish")} disabled={Boolean(pending)}>정석몰에 게시</button>}
          </div>
          {["APPROVED", "PUBLISHED"].includes(detail.status) && <form className="short-create-form" onSubmit={(event) => createShort(event, product.id, detail.id)}><strong>승인 팩트로 쇼츠 대본 만들기</strong><select name="durationSeconds" defaultValue="15"><option value="15">15초</option><option value="30">30초</option></select><input name="angle" minLength={2} maxLength={120} defaultValue="불편 해결" required /><button disabled={Boolean(pending)}>대본 생성</button></form>}
          {productShorts.map((short) => <div className="short-project" key={short.id}><div className="short-project-summary"><div><span>{short.durationSeconds}초 · {short.angle}</span><strong>{short.selectedHook}</strong><small>{short.script.length} SCENES · {short.status}</small></div>{["SCRIPT_READY", "FAILED"].includes(short.status) && <button disabled={Boolean(pending)} onClick={() => renderShort(short)}>{pending === `render:${short.id}` ? "렌더링…" : "MP4 렌더"}</button>}{short.status === "READY" && <nav><a href={short.renderArtifactUrl ?? "#"}>MP4</a><a href={short.captionUrl ?? "#"}>SRT</a><a href={short.thumbnailUrl ?? "#"}>썸네일</a><a href={`/api/admin/content/artifacts/${short.id}?type=manifest`}>매니페스트</a><a href={`/api/admin/content/artifacts/${short.id}?type=script`}>대본</a></nav>}</div>
            {["SCRIPT_READY", "FAILED"].includes(short.status) && <details className="short-editor"><summary>훅·장면별 대본 편집</summary><form onSubmit={(event) => saveShort(event, short)}><label><span>선택 훅</span><select name="selectedHook" defaultValue={short.selectedHook ?? short.hooks[0]}>{short.hooks.map((hook) => <option key={hook}>{hook}</option>)}</select></label>{short.script.map((scene, index) => <fieldset key={scene.scene}><legend>SCENE {scene.scene} · {scene.startSeconds}s</legend><label><span>음성</span><textarea name={`voice:${index}`} defaultValue={scene.voice} required /></label><label><span>화면 자막</span><input name={`onScreen:${index}`} defaultValue={scene.onScreen} required /></label></fieldset>)}<button className="admin-primary-button" disabled={Boolean(pending)}>대본 저장</button></form></details>}
          </div>)}
        </>}
      </article>;
    })}</section>
    {message && <div className="admin-toast" role="status">{message}</div>}
  </div>;
}
