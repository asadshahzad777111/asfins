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
    <header className="studio-header relative flex items-center gap-5 border-b border-white/12 bg-ink px-4 py-3 text-paper sm:px-6">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease }}
        className="relative z-10 flex min-w-0 items-center gap-4"
      >
        <Link href="/studio" className="group shrink-0">
          <p className="font-display text-lg leading-none tracking-tight transition-opacity group-hover:opacity-70 sm:text-xl">
            {SHOP.name}
            <span className="align-super text-[0.5em]">®</span>
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-paper/40">
            {t("atelierMark")}
          </p>
        </Link>

        <div className="hidden h-6 w-px bg-paper/20 sm:block" />

        <div className="hidden min-w-0 sm:block">
          <p className="text-[11px] tracking-[0.06em] text-paper/55">
            {t("virtualDesignStudio")}
          </p>
          <p className="mt-0.5 text-[10px] text-paper/35">{t("atelierLiveBadge")}</p>
        </div>
      </motion.div>

      <motion.nav
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease }}
        className="relative z-10 ml-auto flex items-center gap-4"
      >
        <Link
          href="/gallery"
          className="nav-underline text-[12px] text-paper/60 transition-opacity hover:text-paper"
        >
          {t("studioGuide")}
        </Link>
        <Link
          href="/products"
          className="nav-underline hidden text-[12px] text-paper/60 transition-opacity hover:text-paper sm:inline"
        >
          {t("products")}
        </Link>
        <LanguageSwitcher variant="dark" />
      </motion.nav>
    </header>
  );
}
