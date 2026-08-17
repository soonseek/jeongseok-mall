import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getCredentialsMasterKey } from "@/lib/security/master-key";

export type EncryptedCredential = { encryptedSecret: string; nonce: string; tag: string };

export async function encryptCredential(secret: string): Promise<EncryptedCredential> {
  const key = await getCredentialsMasterKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    encryptedSecret: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export async function decryptCredential(input: EncryptedCredential): Promise<string> {
  const key = await getCredentialsMasterKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.nonce, "base64"));
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.encryptedSecret, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
