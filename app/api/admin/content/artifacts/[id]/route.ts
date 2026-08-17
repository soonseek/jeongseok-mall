import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { shortArtifactDirectory } from "@/lib/content/local-renderer";
import { getShortProject } from "@/lib/db/content";

const files = {
  mp4: { name: "short.mp4", type: "video/mp4" },
  srt: { name: "captions.srt", type: "application/x-subrip; charset=utf-8" },
  thumbnail: { name: "thumbnail.png", type: "image/png" },
  manifest: { name: "manifest.json", type: "application/json; charset=utf-8" },
  script: { name: "script.json", type: "application/json; charset=utf-8" },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request);
  if (auth instanceof NextResponse) return auth;
  const id = (await params).id;
  const project = await getShortProject(id);
  if (!project || project.status !== "READY") return NextResponse.json({ error: "완료된 산출물을 찾지 못했습니다." }, { status: 404 });
  const type = request.nextUrl.searchParams.get("type") as keyof typeof files | null;
  if (!type || !files[type]) return NextResponse.json({ error: "산출물 유형을 확인해 주세요." }, { status: 400 });
  try {
    const definition = files[type];
    const body = await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ shortArtifactDirectory(id), definition.name));
    return new NextResponse(body, { headers: { "content-type": definition.type, "content-disposition": `attachment; filename="jeongseok-${id.slice(0, 8)}-${definition.name}"`, "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "산출물 파일이 없습니다. 다시 렌더해 주세요." }, { status: 404 });
  }
}
