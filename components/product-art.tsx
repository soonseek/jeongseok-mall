import type { Product } from "@/lib/types";

export function ProductArt({ product, compact = false }: { product: Pick<Product, "name" | "category" | "accent">; compact?: boolean }) {
  const initials = product.name.replace("정석 ", "").split(" ").map((part) => part[0]).join("").slice(0, 2);
  return <div className={`product-art ${compact ? "compact" : ""}`} style={{ "--product-accent": product.accent } as React.CSSProperties}>
    <div className="product-art-grid" />
    <div className="product-object"><span>{initials}</span></div>
    <small>{product.category} / JEONGSEOK</small>
  </div>;
}
