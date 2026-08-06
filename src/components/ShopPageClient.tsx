"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { formatPKR, resolveSheetRate } from "@/lib/rates";
import {
  SHOP_FILTERS,
  isSheetCategory,
  productMatchesShopFilter,
  type ShopFilterId,
  unitLabelForCategory,
} from "@/lib/products/categories";
import {
  buildSheetCatalogFolders,
  productCatalogLabel,
  productInCatalog,
} from "@/lib/products/shop-catalogs";
import {
  compareByStockAvailability,
  getStockStatus,
  stockStatusLabelKey,
} from "@/lib/stock";
import type { Product } from "@/lib/products/types";
import { BrandCatalogFolders } from "@/components/BrandCatalogFolders";
import { Reveal } from "@/components/motion/Reveal";

interface ShopPageClientProps {
  products: Product[];
}

const ease = [0.22, 1, 0.36, 1] as const;

function matchesProductQuery(p: Product, q: string): boolean {
  if (!q) return true;
  const code = String(p.productCode ?? "").toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  if (qDigits && code.replace(/\D/g, "").includes(qDigits)) return true;
  if (code.includes(q)) return true;
  const hay = [
    p.name,
    p.productCode,
    p.brandName,
    p.materialCategory,
    p.category,
    p.description,
    p.colorDescription,
    productCatalogLabel(p),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function ProductCard({ p }: { p: Product }) {
  const { t } = useLanguage();
  const rate = resolveSheetRate({
    pricePKR: p.pricePKR,
    materialCategory: p.materialCategory,
    substrate: p.substrate,
    description: p.description,
  });
  const unitKey = unitLabelForCategory(p.category);
  const stock = getStockStatus(p.stock, p.lowStockAt);
  const catalogLabel = isSheetCategory(p.category)
    ? productCatalogLabel(p)
    : p.brandName;
  const code = (p.productCode || "").trim();

  return (
    <Link
      href={`/products/${p.id}`}
      className="group flex flex-col border border-divider bg-paper transition-colors hover:border-ink/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-base">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image}
          alt={code ? `${code} — ${p.name}` : p.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {code && (
          <div className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] border border-ink/15 bg-paper/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm sm:left-3 sm:top-3 sm:px-3 sm:py-2">
            <p className="font-mono-data text-[9px] uppercase tracking-[0.16em] text-muted">
              {t("productCode")}
            </p>
            <p className="font-mono-data text-base font-medium leading-none tracking-wide text-ink sm:text-lg">
              {code}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        {catalogLabel && (
          <p className="font-mono-data text-[9px] uppercase tracking-[0.16em] text-brass sm:text-[10px] sm:tracking-[0.18em]">
            {catalogLabel}
          </p>
        )}
        {code && (
          <p className="font-mono-data text-sm tracking-wide text-ink sm:text-base">
            <span className="text-muted">{t("codeShort")}: </span>
            {code}
          </p>
        )}
        <h2 className="font-display text-base leading-snug text-charcoal sm:text-lg">
          {p.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-mono-data text-sm text-ink">
            {rate != null ? formatPKR(rate) : t("ratesComingSoon")}
            {rate != null && (
              <span className="ml-1 text-[10px] uppercase tracking-wider text-muted">
                {t(unitKey)}
              </span>
            )}
          </p>
          <p className="font-mono-data text-[10px] uppercase tracking-wider text-muted">
            {t(stockStatusLabelKey(stock))}
            {typeof p.stock === "number" ? ` · ${p.stock}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function ShopPageClient({ products }: ShopPageClientProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ShopFilterId>("all");
  const [query, setQuery] = useState("");
  const [openCatalogId, setOpenCatalogId] = useState<string | null>(null);

  const typeFiltered = useMemo(
    () => products.filter((p) => productMatchesShopFilter(p.category, filter)),
    [products, filter]
  );

  const folders = useMemo(
    () => buildSheetCatalogFolders(typeFiltered),
    [typeFiltered]
  );

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const showCatalogFolders =
    !searching &&
    !openCatalogId &&
    (filter === "all" || filter === "sheets") &&
    folders.length > 0;

  const accessoryOnly =
    filter !== "all" && filter !== "sheets" && !isSheetCategory(filter);

  const openFolder = folders.find((f) => f.id === openCatalogId) ?? null;

  const listedProducts = useMemo(() => {
    let list = typeFiltered;
    if (openCatalogId && !searching) {
      list = list.filter((p) => productInCatalog(p, openCatalogId));
    } else if (showCatalogFolders) {
      // folders view — no flat list
      list = [];
    } else if (filter === "all" && !searching && !accessoryOnly) {
      // when somehow no folders, fall through
      list = typeFiltered;
    }

    if (q) list = list.filter((p) => matchesProductQuery(p, q));
    return [...list].sort(compareByStockAvailability);
  }, [
    typeFiltered,
    openCatalogId,
    searching,
    showCatalogFolders,
    filter,
    accessoryOnly,
    q,
  ]);

  /** Search across all type-filtered products */
  const searchResults = useMemo(() => {
    if (!searching) return [];
    return typeFiltered
      .filter((p) => matchesProductQuery(p, q))
      .sort(compareByStockAvailability);
  }, [typeFiltered, searching, q]);

  const gridProducts = searching
    ? searchResults
    : accessoryOnly || openCatalogId
      ? listedProducts.length
        ? listedProducts
        : [...typeFiltered]
            .filter((p) =>
              openCatalogId ? productInCatalog(p, openCatalogId) : true
            )
            .sort(compareByStockAvailability)
      : listedProducts;

  function setTypeFilter(id: ShopFilterId) {
    setFilter(id);
    setOpenCatalogId(null);
  }

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
            {t("productsSubtitleCatalogs")}
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
                  onClick={() => setTypeFilter(f.id)}
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

        <AnimatePresence mode="wait">
          {showCatalogFolders ? (
            <motion.div
              key="folders"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="mt-10"
            >
              <p className="mb-4 font-mono-data text-[11px] uppercase tracking-[0.18em] text-muted">
                {t("chooseCatalogFolder")}
              </p>
              <BrandCatalogFolders
                folders={folders.map((f) => ({
                  id: f.id,
                  name: f.label,
                  logoBrand: f.brandName,
                  count: f.count,
                  previewUrl: f.previewUrl,
                }))}
                onOpen={setOpenCatalogId}
                hideBrandLogo={false}
              />

              {filter === "all" &&
                products.some((p) => !isSheetCategory(p.category)) && (
                  <div className="mt-10">
                    <p className="mb-4 font-mono-data text-[11px] uppercase tracking-[0.18em] text-muted">
                      {t("filterAccessories")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          "handles",
                          "hardware",
                          "organizers",
                          "sinks",
                          "accessories",
                        ] as const
                      ).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTypeFilter(id)}
                          className="border border-divider bg-paper px-4 py-2 font-mono-data text-[11px] uppercase tracking-wider text-ink hover:border-ink"
                        >
                          {t(
                            id === "handles"
                              ? "filterHandles"
                              : id === "hardware"
                                ? "filterHardware"
                                : id === "organizers"
                                  ? "filterOrganizers"
                                  : id === "sinks"
                                    ? "filterSinks"
                                    : "filterAccessories"
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="mt-10"
            >
              {(openCatalogId || (!accessoryOnly && !searching && filter === "sheets")) &&
                openFolder && (
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenCatalogId(null)}
                      className="font-mono-data text-xs text-brass hover:underline"
                    >
                      {t("allCatalogFolders")}
                    </button>
                    <span className="text-muted">/</span>
                    <h2 className="font-display text-2xl text-charcoal">
                      {openFolder.label}
                    </h2>
                    <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted">
                      {t("folderSheetCount", { count: openFolder.count })}
                    </span>
                  </div>
                )}

              {searching && (
                <p className="mb-4 font-mono-data text-[11px] uppercase tracking-wider text-muted">
                  {t("searchResultsCount", { count: gridProducts.length })}
                </p>
              )}

              {gridProducts.length === 0 ? (
                <p className="border border-divider bg-paper p-8 text-center text-muted">
                  {t("productsNoMatch")}
                </p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {gridProducts.map((p) => (
                    <ProductCard key={p.id} p={p} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
