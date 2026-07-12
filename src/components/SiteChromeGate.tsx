"use client";

import { usePathname } from "next/navigation";
import { Footer, Header } from "@/components/SiteChrome";
import { StickyAtelierCTA } from "@/components/StickyAtelierCTA";
import { StickyWhatsAppButton } from "@/components/StickyWhatsAppButton";

export function SiteChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isStudioFlow =
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname.startsWith("/configurator");
  const showStickyAtelier =
    pathname.startsWith("/gallery") || pathname.startsWith("/products");
  const showWhatsApp =
    !isAdmin &&
    !pathname.startsWith("/studio/") &&
    !pathname.startsWith("/configurator") &&
    (pathname.startsWith("/gallery") ||
      pathname.startsWith("/products") ||
      pathname.startsWith("/materials") ||
      pathname.startsWith("/about") ||
      pathname.startsWith("/contact") ||
      pathname === "/");

  if (isAdmin || isStudioFlow) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {showStickyAtelier && <StickyAtelierCTA />}
      {showWhatsApp && (
        <StickyWhatsAppButton
          className={showStickyAtelier ? "bottom-20 sm:bottom-6" : ""}
        />
      )}
    </>
  );
}
