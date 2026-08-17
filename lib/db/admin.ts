import { randomUUID } from "node:crypto";
import { execute, query, withTransaction } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";

export type AdminProductRow = {
  id: string; slug: string; name: string; category: string; short_description: string;
  price: number; stock: number; featured: boolean; status: string; updated_at: string;
};

export async function adminProducts(): Promise<AdminProductRow[]> {
  await seedDatabase();
  const rows = await query<AdminProductRow>(
    `SELECT id, slug, name, category, short_description, price, stock, featured, status, updated_at
     FROM products ORDER BY updated_at DESC, name`,
  );
  return rows.map((row) => ({ ...row, price: Number(row.price), stock: Number(row.stock) }));
}

export async function updateAdminProduct(input: { id: string; name: string; shortDescription: string; price: number; stock: number; status: string; featured: boolean }): Promise<boolean> {
  return (await execute(
    `UPDATE products SET name=$2, short_description=$3, price=$4, stock=$5, status=$6,
       featured=$7, updated_at=now() WHERE id=$1`,
    [input.id, input.name, input.shortDescription, input.price, input.stock, input.status, input.featured],
  )) > 0;
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

export async function getOrderPaymentForCancel(orderId: string): Promise<{ order_id: string; order_status: string; payment_id: string; payment_key: string | null; payment_status: string; amount: number } | null> {
  const rows = await query<{ order_id: string; order_status: string; payment_id: string; payment_key: string | null; payment_status: string; amount: number }>(
    `SELECT o.id AS order_id, o.status AS order_status, p.id AS payment_id, p.payment_key,
            p.status AS payment_status, p.requested_amount AS amount
     FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1 ORDER BY p.created_at DESC LIMIT 1`,
    [orderId],
  );
  return rows[0] ? { ...rows[0], amount: Number(rows[0].amount) } : null;
}

export async function completeCancellation(input: { orderId: string; paymentId: string; reason: string; amount: number; actorId: string; idempotencyKey: string; payload: Record<string, unknown> }): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO payment_cancellations(id, payment_id, reason, amount, idempotency_key, provider_payload, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'COMPLETED',$7)`,
      [randomUUID(), input.paymentId, input.reason, input.amount, input.idempotencyKey, JSON.stringify(input.payload), input.actorId],
    );
    await tx.execute("UPDATE payments SET status='CANCELED', canceled_at=now(), provider_payload=$2::jsonb, updated_at=now() WHERE id=$1", [input.paymentId, JSON.stringify(input.payload)]);
    await tx.execute("UPDATE orders SET status='CANCELED', updated_at=now() WHERE id=$1", [input.orderId]);
  });
}
