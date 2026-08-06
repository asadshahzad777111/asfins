"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { CartProvider } from "@/lib/cart/CartContext";
import { SmoothScroll } from "@/components/motion/SmoothScroll";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <CartProvider>
        <SmoothScroll>{children}</SmoothScroll>
      </CartProvider>
    </LanguageProvider>
  );
}
