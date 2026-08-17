import "server-only";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type { Product, ShortProject } from "@/lib/types";

const execFile = promisify(execFileCallback);

function srtTime(seconds: number) {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function captionLines(value: string) {
  const clean = value.replaceAll("\n", " ").trim();
  if (clean.length <= 18) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (!last || `${last} ${word}`.length > 18) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }
  return lines.slice(0, 3);
}

export function shortArtifactDirectory(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_ARTIFACT_ID");
  return path.join(/* turbopackIgnore: true */ process.cwd(), "render-output", id);
}

export async function renderLocalShort(project: ShortProject, product: Product) {
  const root = shortArtifactDirectory(project.id);
  await mkdir(root, { recursive: true });
  const captionsPath = path.join(root, "captions.srt");
  const thumbnailPath = path.join(root, "thumbnail.png");
  const videoPath = path.join(root, "short.mp4");
  const scriptPath = path.join(root, "script.json");
  const manifestPath = path.join(root, "manifest.json");
  const voicePath = path.join(root, "voice.aiff");

  const captions = project.script.map((scene, index) => `${index + 1}\n${srtTime(scene.startSeconds)} --> ${srtTime(scene.startSeconds + scene.duration)}\n${scene.onScreen.replaceAll("\n", " ")}\n`).join("\n");
  await writeFile(captionsPath, captions, "utf8");
  await writeFile(scriptPath, JSON.stringify(project.script, null, 2), "utf8");

  const accent = /^#[0-9a-f]{6}$/i.test(product.accent) ? product.accent : "#0047ff";
  const hook = project.selectedHook?.slice(0, 34) ?? product.shortDescription.slice(0, 34);
  const thumbnailHookLines = captionLines(hook);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="#111318"/>
    <rect x="70" y="70" width="940" height="1780" rx="38" fill="${accent}"/>
    <text x="110" y="175" font-family="Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" font-size="34" font-weight="700" fill="white" letter-spacing="5">JEONGSEOK MALL · ${project.durationSeconds} SEC</text>
    <text x="110" y="750" font-family="Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" font-size="92" font-weight="800" fill="white">${escapeXml(product.name)}</text>
    <text x="110" y="880" font-family="Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" font-size="48" font-weight="600" fill="white">${thumbnailHookLines.map((line, lineIndex) => `<tspan x="110" dy="${lineIndex === 0 ? 0 : 64}">${escapeXml(line)}</tspan>`).join("")}</text>
    <text x="110" y="1660" font-family="Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" font-size="46" font-weight="700" fill="white">${product.price.toLocaleString("ko-KR")}원</text>
    <text x="110" y="1740" font-family="Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" font-size="28" fill="white">FACT-GROUNDED LOCAL RENDER</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(thumbnailPath);

  const captionPaths: string[] = [];
  for (const [index, scene] of project.script.entries()) {
    const captionPath = path.join(root, `caption-${String(index + 1).padStart(2, "0")}.png`);
    const lines = captionLines(scene.onScreen);
    const captionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="320" viewBox="0 0 1080 320">
      <rect x="70" y="30" width="940" height="${Math.max(150, lines.length * 72 + 54)}" rx="28" fill="#111318" fill-opacity="0.88"/>
      <text x="540" y="112" text-anchor="middle" font-family="Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" font-size="50" font-weight="700" fill="white">${lines.map((line, lineIndex) => `<tspan x="540" dy="${lineIndex === 0 ? 0 : 68}">${escapeXml(line)}</tspan>`).join("")}</text>
    </svg>`;
    await sharp(Buffer.from(captionSvg)).png().toFile(captionPath);
    captionPaths.push(captionPath);
  }

  let hasVoice = false;
  if (process.platform === "darwin") {
    try {
      const narration = project.script.map((scene) => scene.voice).join(" ");
      await execFile("/usr/bin/say", ["-o", voicePath, narration], { timeout: 120_000 });
      hasVoice = (await stat(voicePath)).size > 128;
    } catch {
      hasVoice = false;
    }
  }

  const inputArgs = hasVoice
    ? ["-loop", "1", "-framerate", "30", "-i", thumbnailPath, "-i", voicePath]
    : ["-loop", "1", "-framerate", "30", "-i", thumbnailPath, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  for (const captionPath of captionPaths) inputArgs.push("-loop", "1", "-framerate", "30", "-i", captionPath);
  const overlays = project.script.map((scene, index) => {
    const input = index === 0 ? "[0:v]" : `[v${index}]`;
    return `${input}[${index + 2}:v]overlay=0:1230:enable='between(t,${scene.startSeconds},${scene.startSeconds + scene.duration})'[v${index + 1}]`;
  }).join(";");
  const videoOutput = `[v${project.script.length}]`;
  await execFile(process.env.FFMPEG_PATH ?? "ffmpeg", [
    "-y", ...inputArgs,
    "-filter_complex", overlays,
    "-map", videoOutput, "-map", "1:a",
    "-af", "apad",
    "-t", String(project.durationSeconds),
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", videoPath,
  ], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });

  const manifest = {
    renderer: "JEONGSEOK_LOCAL_FFMPEG",
    rendererVersion: "1.0.0",
    projectId: project.id,
    productId: product.id,
    detailPageVersionId: project.detailPageVersionId,
    width: 1080,
    height: 1920,
    durationSeconds: project.durationSeconds,
    fps: 30,
    audio: hasVoice ? "macOS say" : "silent fallback",
    captions: "SRT + burned-in PNG overlays",
    externalDataTransfer: false,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return { root, videoPath, captionsPath, thumbnailPath, scriptPath, manifestPath, manifest };
}
