"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ZrkCatalogCard } from "@/components/ZrkCatalogCard";
import {
  BrandCatalogFolders,
  catalogsToFolders,
} from "@/components/BrandCatalogFolders";
import { BrandLogo } from "@/components/BrandLogo";
import type { Catalog } from "@/lib/catalogs/types";
import type { CatalogMaterial } from "@/lib/catalogs/materials";
import type { Product } from "@/lib/products/types";
import { Reveal } from "@/components/motion/Reveal";
import {
  filterSwatchesBySeries,
  groupSwatchesBySeries,
  type SeriesFolder,
} from "@/lib/catalogs/series";
import {
  loadProductsCatalogNav,
  saveProductsCatalogNav,
} from "@/lib/catalogs/catalog-nav";
import { formatPKR, resolveSheetRate } from "@/lib/rates";
import { getStockStatus, stockStatusLabelKey } from "@/lib/stock";

interface ProductsPageClientProps {
  products: Product[];
  materials: CatalogMaterial[];
  catalogs: Catalog[];
}

const ease = [0.22, 1, 0.36, 1] as const;

const folderMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.4, ease },
};

type CatalogItem = {
  key: string;
  href: string;
  imageSrc?: string;
  thumbSrc?: string;
  hex?: string;
  code: string;
  title: string;
  subtitle?: string;
  meta?: string;
  brand?: string;
};

function initialProductsNav() {
  const saved = loadProductsCatalogNav();
  return {
    filter: saved?.filter ?? "",
    openCatalogId: saved?.catalogId ?? null,
    openSeriesId: saved?.openSeriesId ?? null,
  };
}

export function ProductsPageClient({
  products,
  materials,
  catalogs,
}: ProductsPageClientProps) {
  const { t } = useLanguage();
  const [nav, setNav] = useState(initialProductsNav);
  const { filter, openCatalogId, openSeriesId } = nav;

  useEffect(() => {
    saveProductsCatalogNav({
      browsingFolders: !openCatalogId,
      openSeriesId,
      filter,
      catalogId: openCatalogId,
    });
  }, [openCatalogId, openSeriesId, filter]);

  function setFilter(v: string) {
    setNav((prev) => ({ ...prev, filter: v }));
  }
  function setOpenCatalogId(v: string | null) {
    setNav((prev) => ({ ...prev, openCatalogId: v }));
  }
  function setOpenSeriesId(v: string | null) {
    setNav((prev) => ({ ...prev, openSeriesId: v }));
  }

  const folders = useMemo(
    () => catalogsToFolders(catalogs, { requireGlobal: true }),
    [catalogs]
  );
  const openCatalog = catalogs.find((c) => c.id === openCatalogId) ?? null;

  const seriesFolders: SeriesFolder[] = useMemo(() => {
    if (!openCatalog) return [];
    return groupSwatchesBySeries(openCatalog.swatches);
  }, [openCatalog]);

  const showSeriesStep =
    Boolean(openCatalogId) &&
    !openSeriesId &&
    !filter.trim() &&
    seriesFolders.length > 1;

  const items = useMemo(() => {
    const materialIds = new Set(materials.map((m) => m.swatch.id));
    const scopedMaterials = openCatalogId
      ? materials.filter((m) => m.catalogId === openCatalogId)
      : materials;

    const seriesScoped =
      openCatalogId && openSeriesId && openCatalog
        ? filterSwatchesBySeries(openCatalog.swatches, openSeriesId)
        : null;
    const seriesIds = seriesScoped
      ? new Set(seriesScoped.map((s) => s.id))
      : null;

    const brandName = openCatalog?.companyName.toLowerCase() ?? "";

    const all: CatalogItem[] = [
      ...scopedMaterials
        .filter((m) => !seriesIds || seriesIds.has(m.swatch.id))
        .map((m) => {
          const rate = resolveSheetRate({
            pricePKR: m.swatch.pricePKR,
            materialCategory: m.swatch.materialCategory,
            substrate: m.swatch.substrate,
            description: m.swatch.description,
          });
          const status = getStockStatus(m.swatch.stock, m.swatch.lowStockAt);
          return {
            key: `mat-${m.catalogId}-${m.swatch.id}`,
            href: `/materials/${m.catalogId}/${m.swatch.id}`,
            imageSrc: m.swatch.imageUrl,
            thumbSrc: m.swatch.thumbUrl,
            hex: m.swatch.hex,
            code: m.swatch.sheetCode,
            title: m.swatch.name,
            subtitle: m.swatch.materialCategory ?? m.catalogName,
            brand: m.catalogName,
            meta:
              rate > 0
                ? `${formatPKR(rate)} · ${t(stockStatusLabelKey(status))}`
                : m.swatch.surfaceFinish,
          };
        }),
      ...products
        .filter((p) => !materialIds.has(p.id))
        .filter((p) => {
          if (!openCatalogId) return true;
          if (openSeriesId) return false;
          if (!brandName) return false;
          return (p.brandName ?? p.category ?? "")
            .toLowerCase()
            .includes(brandName.split(" ")[0]);
        })
        .map((p) => {
          const rate = resolveSheetRate({
            pricePKR: p.pricePKR,
            materialCategory: p.materialCategory,
            substrate: p.substrate,
            description: p.description,
          });
          const status = getStockStatus(p.stock, p.lowStockAt);
          return {
            key: `prod-${p.id}`,
            href: `/products/${p.id}`,
            imageSrc: p.image,
            thumbSrc: undefined as string | undefined,
            hex: undefined as string | undefined,
            code: p.productCode ?? p.id,
            title: p.name,
            subtitle: p.category,
            brand: p.brandName,
            meta:
              rate > 0
                ? `${formatPKR(rate)} · ${t(stockStatusLabelKey(status))}`
                : p.surfaceFinish,
          };
        }),
    ];

    const q = filter.trim().toLowerCase();
    if (!q) return all;
    const qDigits = q.replace(/\D/g, "");
    return all
      .map((item) => {
        const code = item.code.toLowerCase();
        const title = item.title.toLowerCase();
        const subtitle = (item.subtitle ?? "").toLowerCase();
        const codeDigits = code.replace(/\D/g, "");
        let score = 0;
        if (code === q || codeDigits === q || (qDigits && codeDigits === qDigits))
          score = 3;
        else if (code.startsWith(q) || (qDigits && codeDigits.startsWith(qDigits)))
          score = 2;
        else if (
          code.includes(q) ||
          title.includes(q) ||
          subtitle.includes(q) ||
          (qDigits && codeDigits.includes(qDigits))
        )
          score = 1;
        return { item, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code))
      .map((x) => x.item);
  }, [
    materials,
    products,
    filter,
    openCatalogId,
    openCatalog,
    openSeriesId,
    t,
  ]);

  const showFolders = folders.length > 1 && !openCatalogId && !filter.trim();
  const openSeries = seriesFolders.find((s) => s.id === openSeriesId) ?? null;

  function openBrand(id: string) {
    setOpenCatalogId(id);
    setOpenSeriesId(null);
    setFilter("");
  }

  function backToBrands() {
    setOpenCatalogId(null);
    setOpenSeriesId(null);
    setFilter("");
  }

  function backToSeries() {
    setOpenSeriesId(null);
    setFilter("");
  }

  return (
    <div className="bg-paper text-ink">
      <section className="border-b border-ink">
        <div className="px-[clamp(1.25rem,4vw,2.5rem)] py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease }}
          >
            <p className="text-[13px] uppercase tracking-[0.14em] text-muted">
              {t("products")}
            </p>
            <h1 className="text-heading-lg mt-4 max-w-3xl">{t("productsTitle")}</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
              {t("productsSubtitle")}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="px-[clamp(1.25rem,4vw,2.5rem)] py-12 pb-28 sm:py-16">
        <AnimatePresence mode="wait">
          {showFolders ? (
            <motion.div key="brands" {...folderMotion} className="space-y-8">
              <p className="text-[13px] uppercase tracking-[0.12em] text-muted">
                {t("chooseBrandFolder")}
              </p>
              <BrandCatalogFolders folders={folders} onOpen={openBrand} />
            </motion.div>
          ) : showSeriesStep && openCatalog ? (
            <motion.div key={`series-${openCatalog.id}`} {...folderMotion} className="space-y-8">
              <div className="flex flex-wrap items-center gap-3 border-b border-ink pb-6">
                <button
                  type="button"
                  onClick={backToBrands}
                  className="nav-underline text-[13px] text-muted hover:text-ink"
                >
                  {t("allBrandFolders")}
                </button>
                <span className="text-muted">·</span>
                <div className="flex items-center gap-2">
                  <BrandLogo brandName={openCatalog.companyName} className="h-6 w-auto" />
                  <span className="font-display text-xl tracking-tight">
                    {openCatalog.companyName}
                  </span>
                </div>
              </div>
              <p className="text-[13px] uppercase tracking-[0.12em] text-muted">
                {t("chooseSeriesFolder")}
              </p>
              <BrandCatalogFolders
                folders={seriesFolders.map((s) => ({
                  id: s.id,
                  name: s.name,
                  count: s.count,
                  previewUrl: s.previewUrl,
                  previewHex: s.previewHex,
                }))}
                hideBrandLogo
                onOpen={(id) => {
                  setOpenSeriesId(id);
                  setFilter("");
                }}
              />
            </motion.div>
          ) : (
            <motion.div key={`grid-${openCatalogId}-${openSeriesId}`} {...folderMotion}>
              {(openCatalog || filter.trim()) && (
                <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-ink pb-6">
                  {openCatalog && (
                    <>
                      <button
                        type="button"
                        onClick={backToBrands}
                        className="nav-underline text-[13px] text-muted hover:text-ink"
                      >
                        {t("allBrandFolders")}
                      </button>
                      {seriesFolders.length > 1 && (
                        <>
                          <span className="text-muted">·</span>
                          <button
                            type="button"
                            onClick={backToSeries}
                            className="nav-underline text-[13px] text-muted hover:text-ink"
                          >
                            {t("allSeriesFolders")}
                          </button>
                        </>
                      )}
                      <span className="text-muted">·</span>
                      <div className="flex items-center gap-2">
                        <BrandLogo
                          brandName={openCatalog.companyName}
                          className="h-6 w-auto"
                        />
                        <span className="font-display text-xl tracking-tight">
                          {openCatalog.companyName}
                          {openSeries ? ` · ${openSeries.name}` : ""}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="relative mb-10 max-w-md">
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t("productsFilter")}
                  className="w-full border border-ink bg-paper py-3.5 pl-9 pr-9 text-[14px] placeholder:text-muted/50 focus:outline-none"
                  aria-label={t("productsFilter")}
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50"
                  width="14"
                  height="14"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" />
                  <path
                    d="M8 8l2.5 2.5"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </svg>
                {filter && (
                  <button
                    type="button"
                    onClick={() => setFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/50 hover:text-ink"
                    aria-label={t("clearFilter")}
                  >
                    ×
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <p className="border border-ink/15 p-10 text-center text-muted">
                  {filter.trim() ? t("productsNoMatch") : t("emptyProducts")}
                </p>
              ) : (
                <motion.div
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4"
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: 0.03 } },
                  }}
                >
                  {items.map((item, i) => (
                    <motion.div
                      key={item.key}
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        show: { opacity: 1, y: 0 },
                      }}
                      transition={{ duration: 0.35, ease }}
                    >
                      <Reveal delay={(i % 8) * 0.02}>
                        <ZrkCatalogCard
                          href={item.href}
                          imageSrc={item.imageSrc}
                          thumbSrc={item.thumbSrc}
                          hex={item.hex}
                          code={item.code}
                          title={item.title}
                          subtitle={item.subtitle}
                          meta={item.meta}
                          brand={item.brand}
                        />
                      </Reveal>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
