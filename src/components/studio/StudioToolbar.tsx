"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface StudioToolbarProps {
  sceneName: string;
  zoneLabel: string;
  materialCode: string | null;
  materialName: string;
  ready: boolean;
  onDownload: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  onPrevScene?: () => void;
  onNextScene?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function StudioToolbar({
  sceneName,
  zoneLabel,
  materialCode,
  materialName,
  ready,
  onDownload,
  onReset,
  onFullscreen,
  onPrevScene,
  onNextScene,
  hasPrev,
  hasNext,
}: StudioToolbarProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="studio-toolbar flex flex-wrap items-center gap-2 border-b border-divider bg-marble/95 px-4 py-2.5 backdrop-blur-sm"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {(hasPrev || hasNext) && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={onPrevScene}
              className="flex h-8 w-8 items-center justify-center border border-divider text-muted transition-colors hover:border-brass hover:text-brass disabled:opacity-30"
              aria-label={t("prevScene")}
            >
              ‹
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={onNextScene}
              className="flex h-8 w-8 items-center justify-center border border-divider text-muted transition-colors hover:border-brass hover:text-brass disabled:opacity-30"
              aria-label={t("nextScene")}
            >
              ›
            </button>
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-sm text-charcoal sm:text-base">{sceneName}</p>
          <p className="truncate font-mono-data text-[9px] uppercase tracking-wider text-muted">
            {zoneLabel}
            {materialName ? ` · ${materialName}` : ""}
          </p>
        </div>
      </div>

      {materialCode && (
        <motion.span
          key={materialCode}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="hidden border border-brass/30 bg-brass/10 px-2.5 py-1 font-mono-data text-xs text-brass sm:inline"
        >
          {materialCode}
        </motion.span>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!ready}
          onClick={onDownload}
          className="studio-download-btn"
          title={t("downloadDesign")}
        >
          <DownloadIcon />
          <span className="hidden sm:inline">{t("downloadShort")}</span>
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={onReset}
          className="studio-tool-btn"
          title={t("resetColours")}
        >
          <ResetIcon />
          <span className="hidden sm:inline">{t("resetShort")}</span>
        </button>
        <button
          type="button"
          onClick={onFullscreen}
          className="studio-tool-btn"
          title={t("fullscreen")}
        >
          <FullscreenIcon />
          <span className="hidden sm:inline">{t("fullscreenShort")}</span>
        </button>
      </div>
    </motion.div>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7a5 5 0 019-3M12 7a5 5 0 01-9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 2v3h-3M3 12V9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
