import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { SiteChrome } from "@/components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "정석몰 — 일과 생활의 기준",
  description: "정석강의의 실제 풀스택 커머스·상담·콘텐츠 자동화 프로젝트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><CartProvider><SiteChrome />{children}</CartProvider></body></html>;
}
