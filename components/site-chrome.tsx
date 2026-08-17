"use client";

import { usePathname } from "next/navigation";
import { ChatLauncher } from "@/components/chat-launcher";
import { SiteHeader } from "@/components/site-header";

export function SiteChrome() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <><SiteHeader /><ChatLauncher /></>;
}
