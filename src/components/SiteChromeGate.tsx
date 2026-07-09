"use client";

import { usePathname } from "next/navigation";
import { Footer, Header } from "@/components/SiteChrome";
import { StickyAtelierCTA } from "@/components/StickyAtelierCTA";

export function SiteChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isStudioFlow =
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname.startsWith("/configurator");
  const showSticky =
    pathname.startsWith("/gallery") || pathname.startsWith("/products");

  if (isAdmin || isStudioFlow) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {showSticky && <StickyAtelierCTA />}
    </>
  );
}
