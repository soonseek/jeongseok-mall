import "server-only";
import OpenAI from "openai";
import { getIntegrationSecret } from "@/lib/db/integrations";
import { decryptCredential } from "@/lib/security/credentials";

export async function getOpenAI(): Promise<{ client: OpenAI; model: string } | null> {
  const integration = await getIntegrationSecret("AI_MODEL", "TEST");
  if (!integration?.encrypted_secret || !integration.secret_nonce || !integration.secret_tag || integration.status === "DISABLED") return null;
  const apiKey = await decryptCredential({
    encryptedSecret: integration.encrypted_secret,
    nonce: integration.secret_nonce,
    tag: integration.secret_tag,
  });
  return { client: new OpenAI({ apiKey }), model: String(integration.settings.model ?? "gpt-5.6") };
}
