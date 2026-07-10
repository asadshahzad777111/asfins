"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
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

interface ProductsPageClientProps {
  products: Product[];
  materials: CatalogMaterial[];
  catalogs: Catalog[];
}

const ease = [0.22, 1, 0.36, 1] as const;

export function ProductsPageClient({
  products,
  materials,
  catalogs,
}: ProductsPageClientProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("");
  const [openCatalogId, setOpenCatalogId] = useState<string | null>(null);

  const folders = useMemo(
    () => catalogsToFolders(catalogs, { requireGlobal: true }),
    [catalogs]
  );
  const openCatalog = catalogs.find((c) => c.id === openCatalogId) ?? null;

  const items = useMemo(() => {
    const materialIds = new Set(materials.map((m) => m.swatch.id));
    const scopedMaterials = openCatalogId
      ? materials.filter((m) => m.catalogId === openCatalogId)
      : materials;
    const brandName = openCatalog?.companyName.toLowerCase() ?? "";

    const all = [
      ...scopedMaterials.map((m) => ({
        key: `mat-${m.catalogId}-${m.swatch.id}`,
        href: `/materials/${m.catalogId}/${m.swatch.id}`,
        imageSrc: m.swatch.imageUrl,
        thumbSrc: m.swatch.thumbUrl,
        hex: m.swatch.hex,
        code: m.swatch.sheetCode,
        title: m.swatch.name,
        subtitle: m.swatch.materialCategory ?? m.catalogName,
        meta: m.swatch.surfaceFinish,
      })),
      // Skip products already shown as catalog materials (avoid ZRK duplicates)
      ...products
        .filter((p) => !materialIds.has(p.id))
        .filter((p) => {
          if (!openCatalogId) return true;
          if (!brandName) return false;
          return (p.brandName ?? p.category ?? "").toLowerCase().includes(brandName.split(" ")[0]);
        })
        .map((p) => ({
          key: `prod-${p.id}`,
          href: `/products/${p.id}`,
          imageSrc: p.image,
          thumbSrc: undefined as string | undefined,
          hex: undefined as string | undefined,
          code: p.productCode ?? p.id,
          title: p.name,
          subtitle: p.category,
          meta: p.surfaceFinish,
        })),
    ];

    const q = filter.trim().toLowerCase();
    if (!q) return all;
    const qDigits = q.replace(/\D/g, "");
    return all
      .map((item) => {
        const code = item.code.toLowerCase();
        const title = item.title.toLowerCase();
        const codeDigits = code.replace(/\D/g, "");
        let score = 0;
        if (code === q || codeDigits === q || (qDigits && codeDigits === qDigits)) score = 3;
        else if (code.startsWith(q) || (qDigits && codeDigits.startsWith(qDigits))) score = 2;
        else if (
          code.includes(q) ||
          title.includes(q) ||
          (qDigits && codeDigits.includes(qDigits))
        )
          score = 1;
        return { item, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code))
      .map((x) => x.item);
  }, [materials, products, filter, openCatalogId, openCatalog]);

  const showFolders = folders.length > 1 && !openCatalogId && !filter.trim();

  return (
    <div className="atelier-grain bg-base">
      <section className="relative z-[2] overflow-hidden border-b border-divider bg-marble">
        <div
          className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-brass/10 blur-3xl"
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
          >
            <p className="font-mono-data text-[10px] uppercase tracking-[0.35em] text-brass">
              {t("products")}
            </p>
            <h1 className="font-display mt-4 text-4xl leading-[1.05] tracking-tight text-charcoal sm:text-5xl">
              {t("productsTitle")}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted">{t("productsSubtitle")}</p>
          </motion.div>
        </div>
      </section>

      <section className="relative z-[2] mx-auto max-w-6xl px-4 py-12 pb-28 sm:px-6 sm:py-14">
        {showFolders ? (
          <div className="space-y-6">
            <p className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-muted">
              {t("chooseBrandFolder")}
            </p>
            <BrandCatalogFolders folders={folders} onOpen={setOpenCatalogId} />
          </div>
        ) : (
          <>
            {openCatalog && (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpenCatalogId(null);
                    setFilter("");
                  }}
                  className="font-mono-data text-[10px] uppercase tracking-wider text-brass hover:underline"
                >
                  {t("allBrandFolders")}
                </button>
                <span className="text-divider">·</span>
                <div className="flex items-center gap-2">
                  <BrandLogo brandName={openCatalog.companyName} className="h-6 w-auto" />
                  <span className="font-display text-lg text-charcoal">
                    {openCatalog.companyName}
                  </span>
                </div>
              </div>
            )}

            <div className="relative mb-8 max-w-md">
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("productsFilter")}
                className="w-full rounded-sm border border-divider bg-marble py-3 pl-9 pr-9 font-mono-data text-sm placeholder:text-muted/50"
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
                <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted"
                  aria-label={t("clearFilter")}
                >
                  ×
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="border border-divider bg-marble p-10 text-center text-muted">
                {filter.trim() ? t("productsNoMatch") : t("emptyProducts")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                {items.map((item, i) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ delay: (i % 8) * 0.04, duration: 0.4, ease }}
                  >
                    <ZrkCatalogCard
                      href={item.href}
                      imageSrc={item.imageSrc}
                      thumbSrc={item.thumbSrc}
                      hex={item.hex}
                      code={item.code}
                      title={item.title}
                      subtitle={item.subtitle}
                      meta={item.meta}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
