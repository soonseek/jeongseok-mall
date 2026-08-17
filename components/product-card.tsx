import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";
import { formatWon } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  return <article className="product-card" style={{ "--delay": `${index * 40}ms` } as React.CSSProperties}>
    <Link href={`/products/${product.slug}`} className="product-image-link"><ProductArt product={product} /><span className="product-index">{String(index + 1).padStart(2, "0")}</span></Link>
    <div className="product-meta">
      <div><span>{product.category}</span><h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3></div>
      <p>{product.shortDescription}</p>
      <div className="product-price"><strong>{formatWon(product.price)}</strong>{product.compareAtPrice && <del>{formatWon(product.compareAtPrice)}</del>}<Link href={`/products/${product.slug}`} aria-label={`${product.name} 보기`}><ArrowIcon /></Link></div>
    </div>
  </article>;
}
