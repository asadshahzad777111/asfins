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
      className={`flex ${
        dark ? "border border-current/30" : "border border-ink/20"
      }`}
      role="group"
      aria-label="Language"
    >
      {(["en", "ur"] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={`px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors ${
            lang === code
              ? dark
                ? "bg-paper text-ink"
                : "bg-ink text-paper"
              : dark
                ? "text-current/55 hover:text-current"
                : "text-muted hover:text-ink"
          }`}
          aria-pressed={lang === code}
        >
          {code === "en" ? t("langEn") : t("langUr")}
        </button>
      ))}
    </div>
  );
}
