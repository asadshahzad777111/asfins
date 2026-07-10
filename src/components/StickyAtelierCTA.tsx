"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function StickyAtelierCTA() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center gap-3 border border-ink bg-paper p-3 shadow-[0_16px_48px_rgba(0,0,0,0.12)] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("atelierMark")}
            </p>
            <p className="truncate text-sm text-ink">{t("stickyCtaCopy")}</p>
          </div>
          <Link
            href="/studio/kitchen"
            className="shrink-0 bg-ink px-4 py-2.5 text-[12px] text-paper transition-opacity hover:opacity-80"
          >
            {t("enterStudio")}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
