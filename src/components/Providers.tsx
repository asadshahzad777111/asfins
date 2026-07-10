"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { CustomCursor } from "@/components/motion/CustomCursor";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <SmoothScroll>
        <CustomCursor />
        {children}
      </SmoothScroll>
    </LanguageProvider>
  );
}
