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
      `INSERT INTO orders(id, order_number, email, customer_name, phone, shipping_address, status, subtotal, shipping_fee, total_amount, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'PAYMENT_PENDING',$7,$8,$9,$10)`,
      [orderId, orderNumber, input.email, input.customerName, input.phone, JSON.stringify({ postalCode: input.postalCode, address: input.address, addressDetail: input.addressDetail }), subtotal, shippingFee, totalAmount, input.idempotencyKey],
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

export type PendingOrder = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_id: string;
  payment_status: string;
};

export async function getPendingOrder(orderNumber: string): Promise<PendingOrder | null> {
  const rows = await query<PendingOrder>(
    `SELECT o.id, o.order_number, o.status, o.total_amount,
            p.id AS payment_id, p.status AS payment_status
     FROM orders o JOIN payments p ON p.order_id = o.id
     WHERE o.order_number = $1 ORDER BY p.created_at DESC LIMIT 1`,
    [orderNumber],
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
