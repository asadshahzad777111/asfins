"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function StickyAtelierCTA() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
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
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center gap-3 border border-white/10 bg-ink/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          <div className="min-w-0 flex-1">
            <p className="font-mono-data text-[9px] uppercase tracking-[0.2em] text-brass">
              {t("atelierMark")}
            </p>
            <p className="truncate text-sm text-marble">{t("stickyCtaCopy")}</p>
          </div>
          <Link
            href="/studio/kitchen"
            className="btn-shine shrink-0 bg-brass px-4 py-2.5 font-mono-data text-[10px] uppercase tracking-[0.12em] text-ink"
          >
            {t("enterStudio")}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
