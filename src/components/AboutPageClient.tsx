"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const ease = [0.22, 1, 0.36, 1] as const;

export function AboutPageClient() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="px-[clamp(1.25rem,4vw,2.5rem)] pb-28 pt-14 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease }}
          className="max-w-3xl"
        >
          <p className="text-[13px] uppercase tracking-[0.14em] text-muted">
            {SHOP.legalName} · {SHOP.city}
          </p>
          <h1 className="text-heading-lg mt-4">{t("aboutTitle")}</h1>
          <p className="mt-4 font-display text-2xl tracking-tight text-ink/80 sm:text-3xl">
            {SHOP.tagline}
          </p>
          <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-muted">
            {t("aboutBody1")}
          </p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            {t("aboutBody2")}
          </p>

          <div className="mt-12 flex flex-wrap gap-4">
            <Link
              href="/products"
              className="bg-ink px-6 py-3.5 text-[13px] text-paper transition-opacity hover:opacity-80"
            >
              {t("enterStudio")} →
            </Link>
            <Link
              href="/contact"
              className="border border-ink px-6 py-3.5 text-[13px] transition-opacity hover:opacity-70"
            >
              {t("contact")}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
