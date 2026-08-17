import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";

export type AdminProductRow = {
  id: string; slug: string; name: string; category: string; short_description: string; description: string;
  price: number; compare_at_price: number | null; stock: number; featured: boolean; status: string; accent: string; updated_at: string;
  facts: Array<{ key: string; value: string; evidence: string }>;
};

export async function adminProducts(): Promise<AdminProductRow[]> {
  await seedDatabase();
  const rows = await query<AdminProductRow>(
    `SELECT p.id, p.slug, p.name, p.category, p.short_description, p.description, p.price, p.compare_at_price,
            p.stock, p.featured, p.status, p.accent, p.updated_at,
            COALESCE((SELECT json_agg(json_build_object('key', f.fact_key, 'value', f.fact_value, 'evidence', f.evidence) ORDER BY f.fact_key)
                      FROM product_facts f WHERE f.product_id=p.id), '[]'::json) AS facts
     FROM products p ORDER BY p.updated_at DESC, p.name`,
  );
  return rows.map((row) => ({ ...row, price: Number(row.price), compare_at_price: row.compare_at_price == null ? null : Number(row.compare_at_price), stock: Number(row.stock), facts: typeof row.facts === "string" ? JSON.parse(row.facts) : row.facts }));
}

type AdminProductInput = {
  name: string; slug: string; category: string; shortDescription: string; description: string;
  price: number; compareAtPrice: number | null; stock: number; status: string; featured: boolean; accent: string;
  facts: Array<{ key: string; value: string; evidence: string }>;
};

async function replaceProductFacts(tx: Parameters<Parameters<typeof withTransaction>[0]>[0], productId: string, facts: AdminProductInput["facts"]) {
  await tx.execute("DELETE FROM product_facts WHERE product_id=$1", [productId]);
  for (const fact of facts) {
    await tx.execute(
      "INSERT INTO product_facts(id, product_id, fact_key, fact_value, evidence, status) VALUES ($1,$2,$3,$4,$5,'VERIFIED')",
      [`fact-${productId}-${fact.key}`, productId, fact.key, fact.value, fact.evidence],
    );
  }
}

export async function createAdminProduct(input: AdminProductInput): Promise<AdminProductRow> {
  const id = randomUUID();
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO products(id, slug, name, category, short_description, description, price, compare_at_price, stock, featured, status, accent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, input.slug, input.name, input.category, input.shortDescription, input.description, input.price, input.compareAtPrice, input.stock, input.featured, input.status, input.accent],
    );
    await replaceProductFacts(tx, id, input.facts);
  });
  return (await adminProducts()).find((product) => product.id === id)!;
}

export async function updateAdminProduct(input: AdminProductInput & { id: string }): Promise<boolean> {
  return withTransaction(async (tx) => {
    const changed = await tx.execute(
      `UPDATE products SET slug=$2, name=$3, category=$4, short_description=$5, description=$6,
         price=$7, compare_at_price=$8, stock=$9, status=$10, featured=$11, accent=$12, updated_at=now() WHERE id=$1`,
      [input.id, input.slug, input.name, input.category, input.shortDescription, input.description, input.price, input.compareAtPrice, input.stock, input.status, input.featured, input.accent],
    );
    if (changed > 0) await replaceProductFacts(tx, input.id, input.facts);
    return changed > 0;
  });
}

export type AdminOrderRow = {
  id: string; order_number: string; customer_name: string; email: string; phone: string;
  status: string; total_amount: number; payment_status: string | null; payment_key: string | null;
  method: string | null; created_at: string;
};

export async function adminOrders(): Promise<AdminOrderRow[]> {
  const rows = await query<AdminOrderRow>(
    `SELECT o.id, o.order_number, o.customer_name, o.email, o.phone, o.status, o.total_amount,
            p.status AS payment_status, p.payment_key, p.method, o.created_at
     FROM orders o LEFT JOIN LATERAL (
       SELECT status, payment_key, method FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1
     ) p ON true ORDER BY o.created_at DESC LIMIT 100`,
  );
  return rows.map((row) => ({ ...row, total_amount: Number(row.total_amount) }));
}

export type SupportRunRow = {
  id: string; conversation_id: string; model_provider: string | null; model_name: string | null;
  status: string; latency_ms: number | null; input_tokens: number | null; output_tokens: number | null;
  error_message: string | null; created_at: string; last_user_message: string | null;
};

export async function supportRuns(): Promise<SupportRunRow[]> {
  return query<SupportRunRow>(
    `SELECT r.id, r.conversation_id, r.model_provider, r.model_name, r.status, r.latency_ms,
            r.input_tokens, r.output_tokens, r.error_message, r.created_at,
            (SELECT content FROM messages m WHERE m.conversation_id=r.conversation_id AND m.role='USER' ORDER BY created_at DESC LIMIT 1) AS last_user_message
     FROM agent_runs r ORDER BY r.created_at DESC LIMIT 100`,
  );
}

export type SupportTicketRow = {
  id: string;
  subject: string;
  summary: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  conversation_id: string | null;
};

export async function supportTickets(): Promise<SupportTicketRow[]> {
  return query<SupportTicketRow>(
    `SELECT t.id, t.subject, t.summary, t.status, t.created_at, t.conversation_id,
            u.name AS customer_name, u.email AS customer_email
     FROM support_tickets t
     LEFT JOIN users u ON u.id=t.user_id
     ORDER BY CASE t.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END,
              t.created_at DESC
     LIMIT 100`,
  );
}

export async function updateSupportTicketStatus(id: string, status: SupportTicketRow["status"]): Promise<SupportTicketRow | null> {
  const rows = await query<SupportTicketRow>(
    `UPDATE support_tickets SET status=$2 WHERE id=$1
     RETURNING id, subject, summary, status, created_at, conversation_id,
       (SELECT name FROM users WHERE users.id=support_tickets.user_id) AS customer_name,
       (SELECT email FROM users WHERE users.id=support_tickets.user_id) AS customer_email`,
    [id, status],
  );
  return rows[0] ?? null;
}

export async function getOrderPaymentForCancel(orderId: string): Promise<{ order_id: string; order_status: string; payment_id: string; payment_key: string | null; payment_status: string; amount: number } | null> {
  const rows = await query<{ order_id: string; order_status: string; payment_id: string; payment_key: string | null; payment_status: string; amount: number }>(
    `SELECT o.id AS order_id, o.status AS order_status, p.id AS payment_id, p.payment_key,
            p.status AS payment_status, p.requested_amount AS amount
     FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1 ORDER BY p.created_at DESC LIMIT 1`,
    [orderId],
  );
  return rows[0] ? { ...rows[0], amount: Number(rows[0].amount) } : null;
}

export async function getCancellationByKey(idempotencyKey: string): Promise<{ order_id: string; status: string } | null> {
  const rows = await query<{ order_id: string; status: string }>(
    `SELECT p.order_id, c.status FROM payment_cancellations c
     JOIN payments p ON p.id=c.payment_id WHERE c.idempotency_key=$1 LIMIT 1`,
    [idempotencyKey],
  );
  return rows[0] ?? null;
}

export async function completeCancellation(input: { orderId: string; paymentId: string; reason: string; amount: number; actorId: string; idempotencyKey: string; payload: Record<string, unknown> }): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO payment_cancellations(id, payment_id, reason, amount, idempotency_key, provider_payload, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'COMPLETED',$7)
       ON CONFLICT(idempotency_key) DO UPDATE SET provider_payload=EXCLUDED.provider_payload, status='COMPLETED'`,
      [randomUUID(), input.paymentId, input.reason, input.amount, input.idempotencyKey, JSON.stringify(input.payload), input.actorId],
    );
    await tx.execute("UPDATE payments SET status='CANCELED', canceled_at=now(), provider_payload=$2::jsonb, updated_at=now() WHERE id=$1", [input.paymentId, JSON.stringify(input.payload)]);
    await tx.execute("UPDATE orders SET status='CANCELED', updated_at=now() WHERE id=$1", [input.orderId]);
  });
}
