"use client";

import { useId } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface ColorAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

export function ColorAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  className = "",
}: ColorAutocompleteProps) {
  const { t } = useLanguage();
  const listId = useId().replace(/:/g, "");

  return (
    <div className="color-autocomplete">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="mt-1 text-[10px] text-muted">{t("colorAutocompleteHint")}</p>
    </div>
  );
}
