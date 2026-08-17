import { query } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import type { Product } from "@/lib/types";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: Product["category"];
  short_description: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  featured: boolean;
  status: Product["status"];
  accent: string;
  image_url: string | null;
  detail_page_version_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    shortDescription: row.short_description,
    description: row.description,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
    stock: Number(row.stock),
    featured: Boolean(row.featured),
    status: row.status,
    accent: row.accent,
    imageUrl: row.image_url,
    detailPageVersionId: row.detail_page_version_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listProducts(options: { category?: string; search?: string; featured?: boolean } = {}): Promise<Product[]> {
  await seedDatabase();
  const params: unknown[] = [];
  const clauses = ["status = 'PUBLISHED'"];
  if (options.category && options.category !== "ALL") {
    params.push(options.category);
    clauses.push(`category = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    clauses.push(`(name ILIKE $${params.length} OR short_description ILIKE $${params.length})`);
  }
  if (options.featured) clauses.push("featured = true");
  const rows = await query<ProductRow>(
    `SELECT * FROM products WHERE ${clauses.join(" AND ")} ORDER BY featured DESC, created_at ASC`,
    params,
  );
  return rows.map(mapProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await seedDatabase();
  const rows = await query<ProductRow>("SELECT * FROM products WHERE slug = $1 AND status = 'PUBLISHED' LIMIT 1", [slug]);
  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function getProductById(id: string): Promise<Product | null> {
  await seedDatabase();
  const rows = await query<ProductRow>("SELECT * FROM products WHERE id = $1 LIMIT 1", [id]);
  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function getProductFacts(productId: string): Promise<Array<{ id: string; key: string; value: string; evidence: string }>> {
  return query<{ id: string; key: string; value: string; evidence: string }>(
    "SELECT id, fact_key AS key, fact_value AS value, evidence FROM product_facts WHERE product_id = $1 AND status = 'VERIFIED' ORDER BY fact_key",
    [productId],
  );
}
