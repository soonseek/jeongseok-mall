import { randomUUID } from "node:crypto";
import { execute, query } from "@/lib/db/client";
import { encryptCredential } from "@/lib/security/credentials";

export type IntegrationKind = "TOSS_PAYMENTS" | "AI_MODEL" | "TTS";
export type IntegrationEnvironment = "TEST" | "LIVE";

export type IntegrationSummary = {
  id: string;
  kind: IntegrationKind;
  provider: string;
  label: string;
  environment: IntegrationEnvironment;
  status: "UNCONFIGURED" | "UNVERIFIED" | "READY" | "FAILED" | "DISABLED";
  key_suffix: string | null;
  settings: Record<string, unknown>;
  last_checked_at: string | null;
  last_check_message: string | null;
  updated_at: string;
};

type SecretRow = IntegrationSummary & {
  encrypted_secret: string | null;
  secret_nonce: string | null;
  secret_tag: string | null;
};

export async function listIntegrations(): Promise<IntegrationSummary[]> {
  return query<IntegrationSummary>(
    `SELECT id, kind, provider, label, environment, status, key_suffix, settings,
            last_checked_at, last_check_message, updated_at
     FROM integration_configs ORDER BY kind, environment`,
  );
}

export async function getIntegrationSecret(kind: IntegrationKind, environment: IntegrationEnvironment): Promise<SecretRow | null> {
  const rows = await query<SecretRow>(
    `SELECT id, kind, provider, label, environment, status, key_suffix, settings,
            last_checked_at, last_check_message, updated_at,
            encrypted_secret, secret_nonce, secret_tag
     FROM integration_configs WHERE kind = $1 AND environment = $2 LIMIT 1`,
    [kind, environment],
  );
  return rows[0] ?? null;
}

export async function saveIntegration(input: {
  kind: IntegrationKind;
  provider: string;
  label: string;
  environment: IntegrationEnvironment;
  secret?: string;
  settings: Record<string, unknown>;
  actorId: string;
}): Promise<IntegrationSummary> {
  const existing = await getIntegrationSecret(input.kind, input.environment);
  const encrypted = input.secret ? await encryptCredential(input.secret) : null;
  const id = existing?.id ?? randomUUID();
  const keySuffix = input.secret ? input.secret.slice(-4) : existing?.key_suffix ?? null;
  const encryptedSecret = encrypted?.encryptedSecret ?? existing?.encrypted_secret ?? null;
  const nonce = encrypted?.nonce ?? existing?.secret_nonce ?? null;
  const tag = encrypted?.tag ?? existing?.secret_tag ?? null;
  const status = encryptedSecret ? "UNVERIFIED" : "UNCONFIGURED";

  const rows = await query<IntegrationSummary>(
    `INSERT INTO integration_configs(
       id, kind, provider, label, environment, status, encrypted_secret, secret_nonce,
       secret_tag, key_suffix, settings, created_by, updated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$12)
     ON CONFLICT(kind, environment) DO UPDATE SET
       provider = EXCLUDED.provider,
       label = EXCLUDED.label,
       status = EXCLUDED.status,
       encrypted_secret = EXCLUDED.encrypted_secret,
       secret_nonce = EXCLUDED.secret_nonce,
       secret_tag = EXCLUDED.secret_tag,
       key_suffix = EXCLUDED.key_suffix,
       settings = EXCLUDED.settings,
       credential_version = integration_configs.credential_version + 1,
       last_checked_at = NULL,
       last_check_message = NULL,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING id, kind, provider, label, environment, status, key_suffix, settings,
               last_checked_at, last_check_message, updated_at`,
    [id, input.kind, input.provider, input.label, input.environment, status, encryptedSecret, nonce, tag, keySuffix, JSON.stringify(input.settings), input.actorId],
  );
  return rows[0];
}

export async function disableIntegration(id: string, actorId: string): Promise<boolean> {
  return (await execute(
    "UPDATE integration_configs SET status = 'DISABLED', updated_by = $2, updated_at = now() WHERE id = $1",
    [id, actorId],
  )) > 0;
}
