"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BagIcon, SearchIcon, UserIcon } from "@/components/icons";
import { useCart } from "@/components/cart-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const nav = [
    ["/products", "SHOP"],
    ["/products?category=DESK", "DESK"],
    ["/products?category=MOBILE", "MOBILE"],
    ["/products?category=FOCUS", "FOCUS"],
    ["/policies", "POLICY"],
    ["/about", "ABOUT"],
  ];

  return <header className="site-header">
    <Link className="brand-lockup" href="/" aria-label="정석몰 홈">
      <strong>정석</strong><span>MALL</span>
    </Link>
    <nav className="main-nav" aria-label="주 메뉴">
      {nav.map(([href, label]) => <Link className={pathname === href ? "active" : ""} key={href} href={href}>{label}</Link>)}
    </nav>
    <div className="header-actions">
      <Link href="/products" aria-label="검색"><SearchIcon /></Link>
      <Link href="/account" aria-label="내 계정"><UserIcon /></Link>
      <Link className="cart-link" href="/cart" aria-label={`장바구니 ${count}개`}><BagIcon />{count > 0 && <span>{count}</span>}</Link>
    </div>
  </header>;
}
