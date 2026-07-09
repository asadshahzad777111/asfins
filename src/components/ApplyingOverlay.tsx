"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface ApplyingOverlayProps {
  show: boolean;
}

export function ApplyingOverlay({ show }: ApplyingOverlayProps) {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-4"
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 4, opacity: 0 }}
            className="flex items-center gap-2 rounded-full bg-walnut/85 px-4 py-2 shadow-lg backdrop-blur-sm"
          >
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/40" />
              <span className="relative inline-flex h-4 w-4 animate-spin rounded-full border-2 border-brass border-t-transparent" />
            </span>
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-marble">
              {t("applyingColour")}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
