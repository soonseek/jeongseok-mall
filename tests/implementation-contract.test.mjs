import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("customer, admin, chat, order, payment, and content routes exist", async () => {
  const paths = [
    "app/products/page.tsx",
    "app/cart/page.tsx",
    "app/checkout/page.tsx",
    "app/admin/(protected)/page.tsx",
    "app/api/chat/route.ts",
    "app/api/orders/route.ts",
    "app/api/payments/toss/confirm/route.ts",
    "app/api/admin/content/detail/route.ts",
    "app/api/admin/content/short/route.ts",
  ];
  await Promise.all(paths.map((path) => access(new URL(path, root))));
  assert.equal(paths.length, 9);
});

test("payment confirmation verifies the stored order and amount on the server", async () => {
  const text = await source("app/api/payments/toss/confirm/route.ts");
  assert.match(text, /getPendingOrder/);
  assert.match(text, /Number\(order\.total_amount\) !== parsed\.data\.amount/);
  assert.match(text, /getIntegrationSecret\("TOSS_PAYMENTS", "TEST"\)/);
  assert.match(text, /completeTossPayment/);
});

test("chat answers from the real catalog and keeps a local fallback", async () => {
  const text = await source("app/api/chat/route.ts");
  assert.match(text, /catalogForAgent/);
  assert.match(text, /rankCatalog/);
  assert.match(text, /fallbackAnswer/);
  assert.match(text, /recordAgentTool/);
});

test("detail and shorts endpoints persist versioned local content work", async () => {
  const [detail, short] = await Promise.all([
    source("app/api/admin/content/detail/route.ts"),
    source("app/api/admin/content/short/route.ts"),
  ]);
  assert.match(detail, /createLocalDetailVersion/);
  assert.match(short, /createLocalShortProject/);
  assert.match(detail, /writeAuditLog/);
  assert.match(short, /writeAuditLog/);
});

test("provider credentials are encrypted and never returned as a full secret", async () => {
  const [credentials, integrationRoute, integrationStore] = await Promise.all([
    source("lib/security/credentials.ts"),
    source("app/api/admin/integrations/route.ts"),
    source("lib/db/integrations.ts"),
  ]);
  assert.match(credentials, /aes-256-gcm/);
  assert.match(credentials, /createCipheriv/);
  assert.match(integrationRoute, /saveIntegration/);
  assert.match(integrationStore, /encryptCredential/);
  assert.match(integrationStore, /encrypted_secret/);
  assert.match(integrationStore, /RETURNING id, kind, provider, label, environment, status, key_suffix, settings/);
  assert.doesNotMatch(integrationRoute, /return NextResponse\.json\(\{[^}]*secret:/i);
});
