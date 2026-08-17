"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = { productId: string; slug: string; name: string; price: number; quantity: number; accent: string };
type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  update: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "jeongseok-mall-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const value = localStorage.getItem(CART_KEY);
      // Client storage is intentionally restored after hydration; the server has no access to it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (value) setItems(JSON.parse(value));
    } catch {
      localStorage.removeItem(CART_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    add: (item, quantity = 1) => setItems((current) => {
      const existing = current.find((line) => line.productId === item.productId);
      if (existing) return current.map((line) => line.productId === item.productId ? { ...line, quantity: line.quantity + quantity } : line);
      return [...current, { ...item, quantity }];
    }),
    update: (productId, quantity) => setItems((current) => quantity <= 0 ? current.filter((item) => item.productId !== productId) : current.map((item) => item.productId === productId ? { ...item, quantity } : item)),
    remove: (productId) => setItems((current) => current.filter((item) => item.productId !== productId)),
    clear: () => setItems([]),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider가 필요합니다.");
  return value;
}
