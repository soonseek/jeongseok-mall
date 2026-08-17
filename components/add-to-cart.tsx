"use client";

import { useState } from "react";
import { BagIcon, CheckIcon } from "@/components/icons";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/lib/types";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return <button className="primary-button add-cart-button" onClick={() => {
    add({ productId: product.id, slug: product.slug, name: product.name, price: product.price, accent: product.accent });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }}>{added ? <><CheckIcon /> 장바구니에 담았습니다</> : <><BagIcon /> 장바구니 담기</>}</button>;
}
