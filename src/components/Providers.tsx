"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { CartProvider } from "@/lib/cart/CartContext";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { CustomCursor } from "@/components/motion/CustomCursor";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <CartProvider>
        <SmoothScroll>
          <CustomCursor />
          {children}
        </SmoothScroll>
      </CartProvider>
    </LanguageProvider>
  );
}
