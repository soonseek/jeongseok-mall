import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSession } from "../lib/db/auth";
import { execute, query } from "../lib/db/client";
import { seedDatabase } from "../lib/db/seed";
import { hashPassword } from "../lib/security/password";

type SmokeState = { adminId: string; sessionToken: string };
const baseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:3100";
const statePath = path.join(process.cwd(), ".data", "smoke-session.json");
const command = process.argv[2] ?? "run";

async function prepare() {
  await seedDatabase();
  const [{ id: adminId }] = await query<{ id: string }>(
    `INSERT INTO users(id, email, name, password_hash, role)
     VALUES ($1,$2,'로컬 스모크 관리자',$3,'SUPER_ADMIN') RETURNING id`,
    [randomUUID(), `smoke-${randomUUID()}@jeongseok.test`, await hashPassword(randomUUID())],
  );
  const session = await createSession(adminId);
  await writeFile(statePath, JSON.stringify({ adminId, sessionToken: session.token } satisfies SmokeState), { encoding: "utf8", mode: 0o600 });
  console.log("로컬 스모크 세션 준비 완료");
}

async function cleanup() {
  const state = JSON.parse(await readFile(statePath, "utf8")) as SmokeState;
  await execute("DELETE FROM users WHERE id=$1", [state.adminId]);
  await unlink(statePath);
  console.log("로컬 스모크 세션 정리 완료");
}

async function run() {
  const state = JSON.parse(await readFile(statePath, "utf8")) as SmokeState;
  const headers = { origin: baseUrl, "x-jeongseok-request": "1", cookie: `jeongseok_admin=${state.sessionToken}` };
  async function json(apiPath: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${apiPath}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(`${apiPath} ${response.status}: ${String(result.error ?? "UNKNOWN")}`);
    return result;
  }

  const created = await json("/api/admin/content/detail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: "prod-desk-mat" }) });
  let detail = created.detail as { id: string; version: number; status: string; title: string };
  for (const action of ["request_review", "approve", "publish"]) {
    const changed = await json(`/api/admin/content/detail/${detail.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    detail = changed.detail as typeof detail;
  }
  if (detail.status !== "PUBLISHED") throw new Error("DETAIL_NOT_PUBLISHED");

  const shortCreated = await json("/api/admin/content/short", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: "prod-desk-mat", detailPageVersionId: detail.id, durationSeconds: 15, angle: "불편 해결" }) });
  const short = shortCreated.short as { id: string };
  const rendered = await json(`/api/admin/content/short/${short.id}/render`, { method: "POST" });
  if ((rendered.short as { status?: string }).status !== "READY") throw new Error("SHORT_NOT_READY");

  const [mp4, srt, thumbnail, manifest, publicDetail] = await Promise.all([
    fetch(`${baseUrl}/api/admin/content/artifacts/${short.id}?type=mp4`, { headers }),
    fetch(`${baseUrl}/api/admin/content/artifacts/${short.id}?type=srt`, { headers }),
    fetch(`${baseUrl}/api/admin/content/artifacts/${short.id}?type=thumbnail`, { headers }),
    fetch(`${baseUrl}/api/admin/content/artifacts/${short.id}?type=manifest`, { headers }),
    fetch(`${baseUrl}/products/jeongseok-desk-mat`),
  ]);
  if (![mp4, srt, thumbnail, manifest, publicDetail].every((response) => response.ok)) throw new Error("ARTIFACT_DOWNLOAD_FAILED");
  const mp4Bytes = Buffer.from(await mp4.arrayBuffer());
  const srtText = await srt.text();
  const thumbnailBytes = Buffer.from(await thumbnail.arrayBuffer());
  const manifestJson = await manifest.json() as { width?: number; height?: number; durationSeconds?: number };
  const publicHtml = await publicDetail.text();
  if (mp4Bytes.subarray(4, 8).toString() !== "ftyp" || mp4Bytes.length < 10_000) throw new Error("INVALID_MP4");
  if (!srtText.includes(" --> ")) throw new Error("INVALID_SRT");
  if (thumbnailBytes.subarray(1, 4).toString() !== "PNG") throw new Error("INVALID_THUMBNAIL");
  if (manifestJson.width !== 1080 || manifestJson.height !== 1920 || manifestJson.durationSeconds !== 15) throw new Error("INVALID_MANIFEST");
  if (!publicHtml.includes(detail.title)) throw new Error("PUBLISHED_DETAIL_NOT_VISIBLE");
  console.log(JSON.stringify({ ok: true, detailId: detail.id, detailVersion: detail.version, shortId: short.id, mp4Bytes: mp4Bytes.length, manifest: manifestJson }));
}

if (command === "prepare") await prepare();
else if (command === "cleanup") await cleanup();
else await run();
