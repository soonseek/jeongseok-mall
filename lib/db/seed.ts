import { execute, query } from "@/lib/db/client";
import { seedFacts, seedProducts } from "@/lib/db/seed-data";

export async function seedDatabase(): Promise<void> {
  const existing = await query<{ count: number }>("SELECT count(*)::int AS count FROM products");
  if ((existing[0]?.count ?? 0) > 0) return;

  for (const product of seedProducts) {
    await execute(
      `INSERT INTO products(
        id, slug, name, category, short_description, description, price, compare_at_price,
        stock, featured, status, accent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PUBLISHED',$11)`,
      [
        product.id,
        product.slug,
        product.name,
        product.category,
        product.shortDescription,
        product.description,
        product.price,
        product.compareAtPrice,
        product.stock,
        product.featured,
        product.accent,
      ],
    );
  }

  for (const [productId, key, value, evidence] of seedFacts) {
    await execute(
      "INSERT INTO product_facts(id, product_id, fact_key, fact_value, evidence) VALUES ($1,$2,$3,$4,$5)",
      [`fact-${productId}-${key}`, productId, key, value, evidence],
    );
  }
}
