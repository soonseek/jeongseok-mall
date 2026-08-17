import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";

type ProductForOrder = { id: string; name: string; price: number; stock: number; status: string };

export type CreatedOrder = {
  id: string;
  orderNumber: string;
  orderName: string;
  totalAmount: number;
  email: string;
  customerName: string;
  phone: string;
};

export async function createOrder(input: {
  userId?: string;
  email: string;
  customerName: string;
  phone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
  items: Array<{ productId: string; quantity: number }>;
  idempotencyKey: string;
}): Promise<CreatedOrder> {
  await seedDatabase();
  const uniqueIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await query<ProductForOrder>(
    "SELECT id, name, price, stock, status FROM products WHERE id = ANY($1::text[])",
    [uniqueIds],
  );
  if (products.length !== uniqueIds.length) throw new Error("PRODUCT_NOT_FOUND");
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lines = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    if (product.status !== "PUBLISHED" || product.stock < item.quantity) throw new Error("PRODUCT_UNAVAILABLE");
    return { ...item, name: product.name, unitPrice: Number(product.price), lineTotal: Number(product.price) * item.quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shippingFee = subtotal >= 50000 ? 0 : 3000;
  const totalAmount = subtotal + shippingFee;
  const orderId = randomUUID();
  const orderNumber = `JS-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const paymentId = randomUUID();
  const orderName = lines.length === 1 ? lines[0].name : `${lines[0].name} 외 ${lines.length - 1}건`;

  return withTransaction(async (tx) => {
    const duplicate = await tx.query<{ id: string; order_number: string; total_amount: number; email: string; customer_name: string; phone: string }>(
      "SELECT id, order_number, total_amount, email, customer_name, phone FROM orders WHERE idempotency_key = $1 LIMIT 1",
      [input.idempotencyKey],
    );
    if (duplicate[0]) return {
      id: duplicate[0].id,
      orderNumber: duplicate[0].order_number,
      orderName,
      totalAmount: Number(duplicate[0].total_amount),
      email: duplicate[0].email,
      customerName: duplicate[0].customer_name,
      phone: duplicate[0].phone,
    };

    await tx.execute(
      `INSERT INTO orders(id, order_number, user_id, email, customer_name, phone, shipping_address, status, subtotal, shipping_fee, total_amount, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'PAYMENT_PENDING',$8,$9,$10,$11)`,
      [orderId, orderNumber, input.userId ?? null, input.email, input.customerName, input.phone, JSON.stringify({ postalCode: input.postalCode, address: input.address, addressDetail: input.addressDetail }), subtotal, shippingFee, totalAmount, input.idempotencyKey],
    );
    for (const line of lines) {
      await tx.execute(
        `INSERT INTO order_items(id, order_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [randomUUID(), orderId, line.productId, line.name, line.quantity, line.unitPrice, line.lineTotal],
      );
    }
    await tx.execute(
      `INSERT INTO payments(id, order_id, status, requested_amount) VALUES ($1,$2,'READY',$3)`,
      [paymentId, orderId, totalAmount],
    );
    return { id: orderId, orderNumber, orderName, totalAmount, email: input.email, customerName: input.customerName, phone: input.phone };
  });
}

export type CustomerOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_status: string | null;
  method: string | null;
  receipt_url: string | null;
  created_at: string;
};

export async function listCustomerOrders(userId: string): Promise<CustomerOrderRow[]> {
  const rows = await query<CustomerOrderRow>(
    `SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
            p.status AS payment_status, p.method, p.receipt_url
     FROM orders o LEFT JOIN LATERAL (
       SELECT status, method, receipt_url FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1
     ) p ON true
     WHERE o.user_id=$1 ORDER BY o.created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({ ...row, total_amount: Number(row.total_amount) }));
}

export type CustomerOrderDetail = CustomerOrderRow & {
  customer_name: string;
  email: string;
  phone: string;
  shipping_address: Record<string, string>;
  items: Array<{ id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>;
};

export async function getCustomerOrder(userId: string, orderId: string): Promise<CustomerOrderDetail | null> {
  const rows = await query<Omit<CustomerOrderDetail, "items"> & { shipping_address: Record<string, string> | string }>(
    `SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_name, o.email, o.phone,
            o.shipping_address, o.created_at, p.status AS payment_status, p.method, p.receipt_url
     FROM orders o LEFT JOIN LATERAL (
       SELECT status, method, receipt_url FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1
     ) p ON true WHERE o.id=$1 AND o.user_id=$2 LIMIT 1`,
    [orderId, userId],
  );
  if (!rows[0]) return null;
  const items = await query<{ id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>(
    "SELECT id, product_name, quantity, unit_price, line_total FROM order_items WHERE order_id=$1 ORDER BY id",
    [orderId],
  );
  const address = typeof rows[0].shipping_address === "string" ? JSON.parse(rows[0].shipping_address) : rows[0].shipping_address;
  return {
    ...rows[0],
    total_amount: Number(rows[0].total_amount),
    shipping_address: address,
    items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price), line_total: Number(item.line_total) })),
  };
}

export type PendingOrder = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_id: string;
  payment_status: string;
};

export async function getPendingOrder(orderNumber: string, userId: string): Promise<PendingOrder | null> {
  const rows = await query<PendingOrder>(
    `SELECT o.id, o.order_number, o.status, o.total_amount,
            p.id AS payment_id, p.status AS payment_status
     FROM orders o JOIN payments p ON p.order_id = o.id
     WHERE o.order_number = $1 AND o.user_id=$2 ORDER BY p.created_at DESC LIMIT 1`,
    [orderNumber, userId],
  );
  return rows[0] ?? null;
}

export async function completeTossPayment(input: { order: PendingOrder; paymentKey: string; payload: Record<string, unknown> }): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.execute(
      `UPDATE payments SET payment_key=$1, method=$2, status='APPROVED', approved_amount=$3,
         receipt_url=$4, provider_payload=$5::jsonb, approved_at=now(), updated_at=now()
       WHERE id=$6`,
      [input.paymentKey, String(input.payload.method ?? "UNKNOWN"), Number(input.payload.totalAmount ?? input.order.total_amount), (input.payload.receipt as { url?: string } | undefined)?.url ?? null, JSON.stringify(input.payload), input.order.payment_id],
    );
    await tx.execute("UPDATE orders SET status='PAID', updated_at=now() WHERE id=$1", [input.order.id]);
    await tx.execute(
      `INSERT INTO payment_events(id, payment_id, order_id, event_type, provider_event_id, payload, status)
       VALUES ($1,$2,$3,'PAYMENT_CONFIRMED',$4,$5::jsonb,'PROCESSED')
       ON CONFLICT(provider_event_id) DO NOTHING`,
      [randomUUID(), input.order.payment_id, input.order.id, `confirm:${input.paymentKey}`, JSON.stringify(input.payload)],
    );
  });
}

export async function failTossPayment(order: PendingOrder, payload: Record<string, unknown>): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.execute("UPDATE payments SET status='FAILED', provider_payload=$2::jsonb, updated_at=now() WHERE id=$1", [order.payment_id, JSON.stringify(payload)]);
    await tx.execute("UPDATE orders SET status='PAYMENT_FAILED', updated_at=now() WHERE id=$1", [order.id]);
  });
}

type TossWebhookResult = { processed: boolean; orderId: string; paymentStatus: string; orderStatus: string };

export async function processVerifiedTossWebhook(input: {
  transmissionId: string;
  eventType: string;
  payment: Record<string, unknown>;
}): Promise<TossWebhookResult> {
  const orderNumber = String(input.payment.orderId ?? "");
  const paymentKey = String(input.payment.paymentKey ?? "");
  const tossStatus = String(input.payment.status ?? "UNKNOWN");
  const amount = Number(input.payment.totalAmount ?? 0);
  if (!orderNumber || !paymentKey || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("INVALID_VERIFIED_PAYMENT");

  return withTransaction(async (tx) => {
    const existing = await tx.query<{ order_id: string; payment_id: string | null }>(
      "SELECT order_id, payment_id FROM payment_events WHERE provider_event_id=$1 LIMIT 1",
      [input.transmissionId],
    );
    if (existing[0]) return { processed: false, orderId: existing[0].order_id, paymentStatus: "UNCHANGED", orderStatus: "UNCHANGED" };

    const rows = await tx.query<{ order_id: string; order_status: string; total_amount: number; payment_id: string; payment_status: string }>(
      `SELECT o.id AS order_id, o.status AS order_status, o.total_amount, p.id AS payment_id, p.status AS payment_status
       FROM orders o JOIN payments p ON p.order_id=o.id
       WHERE o.order_number=$1 ORDER BY p.created_at DESC LIMIT 1`,
      [orderNumber],
    );
    const local = rows[0];
    if (!local) throw new Error("WEBHOOK_ORDER_NOT_FOUND");
    if (Number(local.total_amount) !== amount) throw new Error("WEBHOOK_AMOUNT_MISMATCH");

    let paymentStatus = local.payment_status;
    let orderStatus = local.order_status;
    if (tossStatus === "DONE") { paymentStatus = "APPROVED"; orderStatus = "PAID"; }
    else if (tossStatus === "CANCELED") { paymentStatus = "CANCELED"; orderStatus = "CANCELED"; }
    else if (["ABORTED", "EXPIRED"].includes(tossStatus)) { paymentStatus = "FAILED"; orderStatus = "PAYMENT_FAILED"; }
    else if (["IN_PROGRESS", "WAITING_FOR_DEPOSIT"].includes(tossStatus)) { paymentStatus = "AUTHENTICATED"; orderStatus = "PAYMENT_PENDING"; }

    const receiptUrl = (input.payment.receipt as { url?: string } | undefined)?.url ?? null;
    await tx.execute(
      `UPDATE payments SET payment_key=$2, method=$3, status=$4,
         approved_amount=CASE WHEN $4='APPROVED' THEN $5 ELSE approved_amount END,
         receipt_url=COALESCE($6, receipt_url), provider_payload=$7::jsonb,
         approved_at=CASE WHEN $4='APPROVED' THEN COALESCE(approved_at, now()) ELSE approved_at END,
         canceled_at=CASE WHEN $4='CANCELED' THEN COALESCE(canceled_at, now()) ELSE canceled_at END,
         updated_at=now() WHERE id=$1`,
      [local.payment_id, paymentKey, String(input.payment.method ?? "UNKNOWN"), paymentStatus, amount, receiptUrl, JSON.stringify(input.payment)],
    );
    await tx.execute("UPDATE orders SET status=$2, updated_at=now() WHERE id=$1", [local.order_id, orderStatus]);
    await tx.execute(
      `INSERT INTO payment_events(id, payment_id, order_id, event_type, provider_event_id, payload, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'PROCESSED')`,
      [randomUUID(), local.payment_id, local.order_id, input.eventType, input.transmissionId, JSON.stringify(input.payment)],
    );
    return { processed: true, orderId: local.order_id, paymentStatus, orderStatus };
  });
}
