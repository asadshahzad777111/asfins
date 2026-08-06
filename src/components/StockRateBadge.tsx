"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatPKR } from "@/lib/rates";
import {
  getStockStatus,
  stockStatusLabelKey,
  type StockStatus,
} from "@/lib/stock";

interface StockRateBadgeProps {
  rate: number;
  stock?: number | null;
  lowStockAt?: number | null;
  unitKey?: "perSheet" | "each";
  className?: string;
}

function statusClass(status: StockStatus): string {
  if (status === "out_of_stock") return "border-red-300 bg-red-50 text-red-800";
  if (status === "low_stock") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-emerald-300/60 bg-emerald-50 text-emerald-900";
}

export function StockRateBadge({
  rate,
  stock,
  lowStockAt,
  unitKey = "perSheet",
  className = "",
}: StockRateBadgeProps) {
  const { t } = useLanguage();
  const status = getStockStatus(stock, lowStockAt);

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      {rate > 0 && (
        <p className="font-mono-data text-xl text-ink sm:text-2xl">
          <span className="mr-2 block text-[10px] uppercase tracking-[0.16em] text-muted sm:mr-2 sm:inline">
            {t("rate")}
          </span>
          {formatPKR(rate)}
          <span className="ml-2 text-xs uppercase tracking-wider text-muted">
            {t(unitKey as TranslationKey)}
          </span>
        </p>
      )}
      <span
        className={`inline-flex w-fit items-center border px-2.5 py-1.5 font-mono-data text-[11px] uppercase tracking-[0.14em] ${statusClass(status)}`}
      >
        <span className="mr-1.5 text-muted/80">{t("stock")}</span>
        {t(stockStatusLabelKey(status))}
        {typeof stock === "number" ? ` · ${stock}` : ""}
      </span>
    </div>
  );
}
