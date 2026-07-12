"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
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
  className = "",
}: StockRateBadgeProps) {
  const { t } = useLanguage();
  const status = getStockStatus(stock, lowStockAt);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {rate > 0 && (
        <p className="font-mono-data text-lg text-brass">
          <span className="mr-2 text-[10px] uppercase tracking-wider text-muted">
            {t("rate")}
          </span>
          {formatPKR(rate)}{" "}
          <span className="text-sm text-muted">{t("perSheet")}</span>
        </p>
      )}
      <span
        className={`inline-flex items-center border px-2.5 py-1 font-mono-data text-[10px] uppercase tracking-[0.14em] ${statusClass(status)}`}
      >
        <span className="mr-1.5 text-muted/80">{t("stock")}</span>
        {t(stockStatusLabelKey(status))}
        {typeof stock === "number" && stock > 0 ? ` · ${stock}` : ""}
      </span>
    </div>
  );
}
