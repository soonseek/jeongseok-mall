import { randomUUID } from "node:crypto";
import { execute, query, withTransaction } from "@/lib/db/client";
import { getProductById, getProductFacts } from "@/lib/db/products";
import { seedDatabase } from "@/lib/db/seed";
import { buildLocalDetailDraft, buildLocalShortDraft } from "@/lib/content/local-generator";
import type { ClaimReportItem, DetailBlock, DetailPageVersion, ShortProject } from "@/lib/types";

export type ContentProductRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  detail_page_version_id: string | null;
  latest_detail_status: string | null;
  latest_detail_version: number | null;
  short_count: number;
  latest_short_status: string | null;
};

type DetailRow = {
  id: string; product_id: string; version: number; status: DetailPageVersion["status"];
  title: string; seo_title: string; seo_description: string; blocks: unknown; claim_report: unknown;
  created_at: Date | string; updated_at: Date | string;
};

type ShortRow = {
  id: string; product_id: string; detail_page_version_id: string; status: ShortProject["status"];
  duration_seconds: 15 | 30; angle: string; selected_hook: string | null; hooks: unknown; script: unknown;
  render_artifact_url: string | null; caption_url: string | null; thumbnail_url: string | null;
  created_at: Date | string; updated_at: Date | string;
};

function jsonValue<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function mapDetail(row: DetailRow): DetailPageVersion {
  return {
    id: row.id,
    productId: row.product_id,
    version: Number(row.version),
    status: row.status,
    title: row.title,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    blocks: jsonValue(row.blocks),
    claimReport: jsonValue(row.claim_report),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapShort(row: ShortRow): ShortProject {
  return {
    id: row.id,
    productId: row.product_id,
    detailPageVersionId: row.detail_page_version_id,
    status: row.status,
    durationSeconds: Number(row.duration_seconds) as 15 | 30,
    angle: row.angle,
    selectedHook: row.selected_hook,
    hooks: jsonValue(row.hooks),
    script: jsonValue(row.script),
    renderArtifactUrl: row.render_artifact_url,
    captionUrl: row.caption_url,
    thumbnailUrl: row.thumbnail_url,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listContentProducts(): Promise<ContentProductRow[]> {
  await seedDatabase();
  const rows = await query<ContentProductRow>(`
    SELECT p.id, p.slug, p.name, p.category, p.status, p.detail_page_version_id,
      d.status AS latest_detail_status, d.version AS latest_detail_version,
      (SELECT count(*)::int FROM short_projects s WHERE s.product_id=p.id) AS short_count,
      (SELECT status FROM short_projects s WHERE s.product_id=p.id ORDER BY created_at DESC LIMIT 1) AS latest_short_status
    FROM products p
    LEFT JOIN LATERAL (
      SELECT status, version FROM detail_page_versions WHERE product_id=p.id ORDER BY version DESC LIMIT 1
    ) d ON true
    ORDER BY p.featured DESC, p.name
  `);
  return rows.map((row) => ({ ...row, latest_detail_version: row.latest_detail_version == null ? null : Number(row.latest_detail_version), short_count: Number(row.short_count) }));
}

export async function listDetailVersions(limit = 60): Promise<DetailPageVersion[]> {
  const rows = await query<DetailRow>(
    `SELECT id, product_id, version, status, title, seo_title, seo_description, blocks, claim_report, created_at, updated_at
     FROM detail_page_versions ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(mapDetail);
}

export async function listShortProjects(limit = 60): Promise<ShortProject[]> {
  const rows = await query<ShortRow>(
    `SELECT id, product_id, detail_page_version_id, status, duration_seconds, angle, selected_hook, hooks, script,
            render_artifact_url, caption_url, thumbnail_url, created_at, updated_at
     FROM short_projects ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(mapShort);
}

export async function createLocalDetailVersion(productId: string, actorId: string): Promise<DetailPageVersion> {
  const product = await getProductById(productId);
  if (!product) throw new Error("상품을 찾지 못했습니다.");
  const facts = await getProductFacts(productId);
  const draft = buildLocalDetailDraft(product, facts);
  const [{ next_version }] = await query<{ next_version: number }>(
    "SELECT coalesce(max(version), 0)::int + 1 AS next_version FROM detail_page_versions WHERE product_id=$1",
    [productId],
  );
  const id = randomUUID();
  const version = Number(next_version ?? 1);
  await execute(
    `INSERT INTO detail_page_versions(id, product_id, version, status, title, seo_title, seo_description, blocks,
      claim_report, generation_manifest, created_by)
     VALUES($1,$2,$3,'DRAFT',$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10)`,
    [id, productId, version, draft.title, draft.seoTitle, draft.seoDescription, JSON.stringify(draft.blocks), JSON.stringify(draft.claimReport), JSON.stringify(draft.generationManifest), actorId],
  );
  const [row] = await query<DetailRow>(
    `SELECT id, product_id, version, status, title, seo_title, seo_description, blocks, claim_report, created_at, updated_at
     FROM detail_page_versions WHERE id=$1`,
    [id],
  );
  return mapDetail(row);
}

export async function createLocalShortProject(input: { productId: string; detailPageVersionId: string; durationSeconds: 15 | 30; angle: string; actorId: string }): Promise<ShortProject> {
  const product = await getProductById(input.productId);
  if (!product) throw new Error("상품을 찾지 못했습니다.");
  const [detail] = await query<{ id: string; status: string }>("SELECT id, status FROM detail_page_versions WHERE id=$1 AND product_id=$2", [input.detailPageVersionId, input.productId]);
  if (!detail) throw new Error("이 상품의 상세페이지 초안을 먼저 만들어 주세요.");
  if (!["APPROVED", "PUBLISHED"].includes(detail.status)) throw new Error("관리자가 승인한 상세페이지 버전이 필요합니다.");
  const facts = await getProductFacts(input.productId);
  const draft = buildLocalShortDraft(product, facts, input.durationSeconds, input.angle);
  const id = randomUUID();
  await execute(
    `INSERT INTO short_projects(id, product_id, detail_page_version_id, status, duration_seconds, angle, selected_hook,
      hooks, script, created_by)
     VALUES($1,$2,$3,'SCRIPT_READY',$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
    [id, input.productId, input.detailPageVersionId, input.durationSeconds, input.angle, draft.selectedHook, JSON.stringify(draft.hooks), JSON.stringify(draft.script), input.actorId],
  );
  const [row] = await query<ShortRow>(
    `SELECT id, product_id, detail_page_version_id, status, duration_seconds, angle, selected_hook, hooks, script,
            render_artifact_url, caption_url, thumbnail_url, created_at, updated_at
     FROM short_projects WHERE id=$1`,
    [id],
  );
  return mapShort(row);
}

export async function getDetailVersion(id: string): Promise<DetailPageVersion | null> {
  const rows = await query<DetailRow>(
    `SELECT id, product_id, version, status, title, seo_title, seo_description, blocks, claim_report, created_at, updated_at
     FROM detail_page_versions WHERE id=$1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapDetail(rows[0]) : null;
}

export async function getPublishedDetailVersion(id: string | null): Promise<DetailPageVersion | null> {
  if (!id) return null;
  const rows = await query<DetailRow>(
    `SELECT id, product_id, version, status, title, seo_title, seo_description, blocks, claim_report, created_at, updated_at
     FROM detail_page_versions WHERE id=$1 AND status='PUBLISHED' LIMIT 1`,
    [id],
  );
  return rows[0] ? mapDetail(rows[0]) : null;
}

export type DetailTransition = "request_review" | "approve" | "reject" | "publish";

export async function transitionDetailVersion(id: string, action: DetailTransition, actorId: string): Promise<DetailPageVersion> {
  const current = await getDetailVersion(id);
  if (!current) throw new Error("DETAIL_NOT_FOUND");
  const transitions: Record<DetailTransition, { from: DetailPageVersion["status"][]; to: DetailPageVersion["status"] }> = {
    request_review: { from: ["DRAFT", "REJECTED"], to: "IN_REVIEW" },
    approve: { from: ["IN_REVIEW"], to: "APPROVED" },
    reject: { from: ["IN_REVIEW"], to: "REJECTED" },
    publish: { from: ["APPROVED"], to: "PUBLISHED" },
  };
  const transition = transitions[action];
  if (!transition.from.includes(current.status)) throw new Error("INVALID_DETAIL_TRANSITION");

  await withTransaction(async (tx) => {
    if (action === "publish") {
      await tx.execute(
        "UPDATE detail_page_versions SET status='APPROVED', updated_at=now() WHERE product_id=$1 AND status='PUBLISHED' AND id<>$2",
        [current.productId, id],
      );
    }
    await tx.execute(
      `UPDATE detail_page_versions SET status=$2, reviewed_by=CASE WHEN $2 IN ('APPROVED','REJECTED','PUBLISHED') THEN $3 ELSE reviewed_by END, updated_at=now() WHERE id=$1`,
      [id, transition.to, actorId],
    );
    if (action === "publish") {
      await tx.execute("UPDATE products SET detail_page_version_id=$2, updated_at=now() WHERE id=$1", [current.productId, id]);
    }
  });
  return (await getDetailVersion(id))!;
}

export async function updateDetailDraft(id: string, input: { title: string; seoTitle: string; seoDescription: string; blocks: DetailBlock[] }): Promise<DetailPageVersion> {
  const current = await getDetailVersion(id);
  if (!current) throw new Error("DETAIL_NOT_FOUND");
  if (!["DRAFT", "REJECTED"].includes(current.status)) throw new Error("DETAIL_NOT_EDITABLE");
  const claimReport: ClaimReportItem[] = input.blocks.flatMap((block) => [block.title, block.body].filter(Boolean).map((text) => ({
    text: text as string,
    status: block.factIds.length > 0 ? "SUPPORTED" as const : "REVIEW_REQUIRED" as const,
    factIds: block.factIds,
  })));
  await execute(
    `UPDATE detail_page_versions SET title=$2, seo_title=$3, seo_description=$4,
       blocks=$5::jsonb, claim_report=$6::jsonb, updated_at=now() WHERE id=$1`,
    [id, input.title, input.seoTitle, input.seoDescription, JSON.stringify(input.blocks), JSON.stringify(claimReport)],
  );
  return (await getDetailVersion(id))!;
}

export async function getShortProject(id: string): Promise<ShortProject | null> {
  const rows = await query<ShortRow>(
    `SELECT id, product_id, detail_page_version_id, status, duration_seconds, angle, selected_hook, hooks, script,
            render_artifact_url, caption_url, thumbnail_url, created_at, updated_at
     FROM short_projects WHERE id=$1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapShort(rows[0]) : null;
}

export async function markShortRendering(id: string): Promise<void> {
  await execute("UPDATE short_projects SET status='RENDERING', error_message=NULL, updated_at=now() WHERE id=$1", [id]);
}

export async function markShortReady(id: string, urls: { video: string; captions: string; thumbnail: string }): Promise<void> {
  await execute(
    "UPDATE short_projects SET status='READY', render_artifact_url=$2, caption_url=$3, thumbnail_url=$4, error_message=NULL, updated_at=now() WHERE id=$1",
    [id, urls.video, urls.captions, urls.thumbnail],
  );
}

export async function markShortFailed(id: string, message: string): Promise<void> {
  await execute("UPDATE short_projects SET status='FAILED', error_message=$2, updated_at=now() WHERE id=$1", [id, message.slice(0, 500)]);
}

export async function updateShortDraft(id: string, input: { selectedHook: string; script: ShortProject["script"] }): Promise<ShortProject> {
  const current = await getShortProject(id);
  if (!current) throw new Error("SHORT_NOT_FOUND");
  if (!["SCRIPT_READY", "FAILED"].includes(current.status)) throw new Error("SHORT_NOT_EDITABLE");
  if (!current.hooks.includes(input.selectedHook)) throw new Error("INVALID_SHORT_HOOK");
  await execute(
    "UPDATE short_projects SET selected_hook=$2, script=$3::jsonb, status='SCRIPT_READY', error_message=NULL, updated_at=now() WHERE id=$1",
    [id, input.selectedHook, JSON.stringify(input.script)],
  );
  return (await getShortProject(id))!;
}
