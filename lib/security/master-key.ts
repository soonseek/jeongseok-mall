import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let cachedKey: Buffer | null = null;

function parseKey(value: string): Buffer | null {
  const trimmed = value.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const decoded = Buffer.from(trimmed, "base64");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

export async function getCredentialsMasterKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  const configured = process.env.CREDENTIALS_MASTER_KEY;
  if (configured) {
    const key = parseKey(configured);
    if (!key) throw new Error("CREDENTIALS_MASTER_KEY must be 32-byte base64 or 64-character hex");
    cachedKey = key;
    return key;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("CREDENTIALS_MASTER_KEY is required in production");
  }

  const dataRoot = path.join(process.cwd(), ".data");
  const filePath = path.join(dataRoot, "credentials.master");
  await mkdir(dataRoot, { recursive: true });
  try {
    const key = parseKey(await readFile(filePath, "utf8"));
    if (!key) throw new Error("Invalid local credentials master key");
    cachedKey = key;
    return key;
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code !== "ENOENT") throw error;
    const key = randomBytes(32);
    await writeFile(filePath, key.toString("base64"), { mode: 0o600, flag: "wx" });
    cachedKey = key;
    return key;
  }
}
