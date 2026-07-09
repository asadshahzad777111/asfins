"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Lang } from "@/lib/i18n/translations";

interface LanguageSwitcherProps {
  variant?: "light" | "dark";
}

export function LanguageSwitcher({ variant = "light" }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useLanguage();
  const dark = variant === "dark";

  return (
    <div
      className={`flex p-0.5 ${
        dark
          ? "border border-white/15 bg-white/5"
          : "border border-divider bg-base"
      }`}
      role="group"
      aria-label="Language"
    >
      {(["en", "ur"] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={`px-2.5 py-1 font-mono-data text-[10px] uppercase tracking-wider transition-colors ${
            lang === code
              ? dark
                ? "bg-brass text-ink"
                : "bg-brass text-marble"
              : dark
                ? "text-marble/50 hover:text-marble"
                : "text-muted hover:text-charcoal"
          }`}
          aria-pressed={lang === code}
        >
          {code === "en" ? t("langEn") : t("langUr")}
        </button>
      ))}
    </div>
  );
}
