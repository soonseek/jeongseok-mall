import { randomUUID } from "node:crypto";
import { execute, query } from "@/lib/db/client";
import { getProductById, getProductFacts } from "@/lib/db/products";
import { seedDatabase } from "@/lib/db/seed";
import { buildLocalDetailDraft, buildLocalShortDraft } from "@/lib/content/local-generator";
import type { DetailPageVersion, ShortProject } from "@/lib/types";

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
  const [detail] = await query<{ id: string }>("SELECT id FROM detail_page_versions WHERE id=$1 AND product_id=$2", [input.detailPageVersionId, input.productId]);
  if (!detail) throw new Error("이 상품의 상세페이지 초안을 먼저 만들어 주세요.");
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

