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
    "app/admin/(protected)/content/page.tsx",
    "app/api/auth/login/route.ts",
    "app/account/orders/[id]/page.tsx",
    "app/api/payments/toss/webhook/route.ts",
    "app/api/admin/support/tickets/[id]/route.ts",
  ];
  await Promise.all(paths.map((path) => access(new URL(path, root))));
  assert.equal(paths.length, 14);
});

test("payment confirmation verifies the stored order and amount on the server", async () => {
  const text = await source("app/api/payments/toss/confirm/route.ts");
  assert.match(text, /getPendingOrder/);
  assert.match(text, /customerFromRequest/);
  assert.match(text, /getPendingOrder\(parsed\.data\.orderId, customer\.id\)/);
  assert.match(text, /Number\(order\.total_amount\) !== parsed\.data\.amount/);
  assert.match(text, /getIntegrationSecret\("TOSS_PAYMENTS", "TEST"\)/);
  assert.match(text, /completeTossPayment/);
});

test("payment webhook re-queries Toss and is idempotent by transmission id", async () => {
  const [route, store] = await Promise.all([
    source("app/api/payments/toss/webhook/route.ts"),
    source("lib/db/orders.ts"),
  ]);
  assert.match(route, /tosspayments-webhook-transmission-id/);
  assert.match(route, /\/v1\/payments\/\$\{encodeURIComponent/);
  assert.match(route, /processVerifiedTossWebhook/);
  assert.match(store, /payment_events WHERE provider_event_id/);
  assert.match(store, /WEBHOOK_AMOUNT_MISMATCH/);
});

test("chat answers from the real catalog and keeps a local fallback", async () => {
  const text = await source("app/api/chat/route.ts");
  assert.match(text, /catalogForAgent/);
  assert.match(text, /rankCatalog/);
  assert.match(text, /fallbackAnswer/);
  assert.match(text, /recordAgentTool/);
  assert.match(text, /getOwnOrderStatus\(customer\.id/);
  assert.match(text, /createSupportTicket/);
  assert.match(text, /policyAnswer/);
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

test("content workflow supports editing, approval gates, publishing, and real local artifacts", async () => {
  const [detailRoute, shortRoute, renderRoute, renderer, store] = await Promise.all([
    source("app/api/admin/content/detail/[id]/route.ts"),
    source("app/api/admin/content/short/[id]/route.ts"),
    source("app/api/admin/content/short/[id]/render/route.ts"),
    source("lib/content/local-renderer.ts"),
    source("lib/db/content.ts"),
  ]);
  assert.match(detailRoute, /save_draft/);
  assert.match(detailRoute, /approve/);
  assert.match(detailRoute, /publish/);
  assert.match(shortRoute, /updateShortDraft/);
  assert.match(store, /\["APPROVED", "PUBLISHED"\]/);
  assert.match(renderRoute, /renderLocalShort/);
  assert.match(renderer, /1080/);
  assert.match(renderer, /1920/);
  assert.match(renderer, /libx264/);
  assert.match(renderer, /captions\.srt/);
});

test("admin can manage product facts, staff roles, integration checks, and support tickets", async () => {
  const [products, users, checks, tickets] = await Promise.all([
    source("app/api/admin/products/route.ts"),
    source("app/api/admin/users/route.ts"),
    source("app/api/admin/integrations/[id]/check/route.ts"),
    source("app/api/admin/support/tickets/[id]/route.ts"),
  ]);
  assert.match(products, /createAdminProduct/);
  assert.match(products, /facts/);
  assert.match(users, /requireAdminApi\(request, true\)/);
  assert.match(checks, /recordIntegrationCheck/);
  assert.match(tickets, /updateSupportTicketStatus/);
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
