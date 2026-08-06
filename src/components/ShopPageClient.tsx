"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { formatPKR, resolveSheetRate } from "@/lib/rates";
import {
  SHOP_FILTERS,
  productMatchesShopFilter,
  type ShopFilterId,
  unitLabelForCategory,
} from "@/lib/products/categories";
import { getStockStatus, stockStatusLabelKey } from "@/lib/stock";
import type { Product } from "@/lib/products/types";
import { Reveal } from "@/components/motion/Reveal";

interface ShopPageClientProps {
  products: Product[];
}

export function ShopPageClient({ products }: ShopPageClientProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ShopFilterId>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!productMatchesShopFilter(p.category, filter)) return false;
      if (!q) return true;
      const hay = [
        p.name,
        p.productCode,
        p.brandName,
        p.category,
        p.description,
        p.colorDescription,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [products, filter, query]);

  return (
    <div className="bg-marble">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Reveal>
          <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
            {t("shopEyebrow")}
          </p>
          <h1 className="font-display mt-3 text-4xl tracking-tight text-charcoal sm:text-5xl">
            {t("productsTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
            {t("productsSubtitle")}
          </p>
        </Reveal>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {SHOP_FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`border px-3 py-1.5 font-mono-data text-[11px] uppercase tracking-wider transition-colors ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-divider bg-paper text-muted hover:border-ink/40 hover:text-ink"
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              );
            })}
          </div>
          <label className="block w-full sm:max-w-xs">
            <span className="sr-only">{t("productsFilter")}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("productsFilter")}
              className="w-full border border-divider bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-12 border border-divider bg-paper p-8 text-center text-muted">
            {t("productsNoMatch")}
          </p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const rate = resolveSheetRate({
                pricePKR: p.pricePKR,
                materialCategory: p.materialCategory,
                substrate: p.substrate,
                description: p.description,
              });
              const unitKey = unitLabelForCategory(p.category);
              const stock = getStockStatus(p.stock, p.lowStockAt);
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group flex flex-col border border-divider bg-paper transition-colors hover:border-ink/30"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-base">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    {p.brandName && (
                      <p className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-brass">
                        {p.brandName}
                      </p>
                    )}
                    <h2 className="font-display mt-1 text-lg leading-snug text-charcoal">
                      {p.name}
                    </h2>
                    <p className="mt-2 font-mono-data text-sm text-ink">
                      {rate != null ? formatPKR(rate) : t("ratesComingSoon")}
                      {rate != null && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-muted">
                          {t(unitKey)}
                        </span>
                      )}
                    </p>
                    <p className="mt-auto pt-3 font-mono-data text-[10px] uppercase tracking-wider text-muted">
                      {t(stockStatusLabelKey(stock))}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
