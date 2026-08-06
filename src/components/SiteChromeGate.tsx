"use client";

import { usePathname } from "next/navigation";
import { Footer, Header, MobileBottomNav } from "@/components/SiteChrome";
import { StickyWhatsAppButton } from "@/components/StickyWhatsAppButton";

export function SiteChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isStudioFlow =
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname.startsWith("/configurator");
  const isCheckout = pathname.startsWith("/cart");
  const showWhatsApp =
    !isAdmin &&
    !isCheckout &&
    !pathname.startsWith("/studio/") &&
    !pathname.startsWith("/configurator");

  if (isAdmin || isStudioFlow) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      {!isCheckout && <Footer />}
      {isCheckout && (
        <footer className="border-t border-stone bg-[#f3f3f3] px-5 py-8 text-center">
          <p className="label-caps text-muted">© ASFins®</p>
        </footer>
      )}
      <MobileBottomNav />
      {showWhatsApp && (
        <StickyWhatsAppButton className="bottom-20 md:bottom-6" />
      )}
    </>
  );
}
