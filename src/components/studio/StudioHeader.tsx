"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const ease = [0.22, 1, 0.36, 1] as const;

export function StudioHeader() {
  const { t } = useLanguage();

  return (
    <header className="studio-header relative flex items-center gap-5 overflow-hidden border-b border-white/8 bg-ink px-4 py-3 text-marble sm:px-6">
      <div className="studio-header__sheen pointer-events-none absolute inset-0" aria-hidden />

      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease }}
        className="relative z-10 flex min-w-0 items-center gap-4"
      >
        <Link href="/studio" className="group shrink-0">
          <p className="font-display text-lg leading-none tracking-tight transition-colors group-hover:text-brass sm:text-xl">
            {SHOP.name}
          </p>
          <p className="font-mono-data mt-1 text-[8px] uppercase tracking-[0.32em] text-marble/40">
            {t("atelierMark")}
          </p>
        </Link>

        <div className="hidden h-8 w-px bg-gradient-to-b from-transparent via-brass/50 to-transparent sm:block" />

        <div className="hidden min-w-0 sm:block">
          <motion.p
            initial={{ opacity: 0, letterSpacing: "0.45em" }}
            animate={{ opacity: 1, letterSpacing: "0.28em" }}
            transition={{ delay: 0.15, duration: 0.7, ease }}
            className="font-mono-data text-[9px] uppercase text-marble/45"
          >
            {t("virtualDesignStudio")}
          </motion.p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="atelier-live-dot" aria-hidden />
            <span className="font-mono-data text-[8px] uppercase tracking-[0.18em] text-marble/35">
              {t("atelierLiveBadge")}
            </span>
          </div>
        </div>
      </motion.div>

      <motion.nav
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45, ease }}
        className="relative z-10 ml-auto flex items-center gap-4"
      >
        <Link
          href="/gallery"
          className="nav-underline font-mono-data text-[10px] uppercase tracking-[0.2em] text-marble/55 transition-colors hover:text-brass"
        >
          {t("studioGuide")}
        </Link>
        <LanguageSwitcher variant="dark" />
      </motion.nav>
    </header>
  );
}
