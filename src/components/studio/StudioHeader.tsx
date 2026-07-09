"use client";

import Link from "next/link";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function StudioHeader() {
  const { t } = useLanguage();

  return (
    <header className="studio-header flex items-center gap-4 border-b border-white/8 bg-ink px-4 py-2.5 text-marble">
      <Link href="/studio" className="shrink-0">
        <p className="font-display text-base leading-none tracking-tight sm:text-lg">{SHOP.name}</p>
        <p className="font-mono-data mt-0.5 text-[8px] uppercase tracking-[0.28em] text-marble/40">
          {t("atelierMark")}
        </p>
      </Link>

      <div className="hidden min-w-0 sm:block">
        <p className="font-mono-data text-[9px] uppercase tracking-[0.3em] text-marble/40">
          {t("virtualDesignStudio")}
        </p>
      </div>

      <nav className="ml-auto flex items-center gap-4">
        <Link
          href="/gallery"
          className="font-mono-data text-[10px] uppercase tracking-wider text-marble/55 transition-colors hover:text-brass"
        >
          {t("studioGuide")}
        </Link>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
