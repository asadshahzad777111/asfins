"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ZrkCatalogCard } from "@/components/ZrkCatalogCard";
import type { CatalogMaterial } from "@/lib/catalogs/materials";
import type { Product } from "@/lib/products/types";

interface ProductsPageClientProps {
  products: Product[];
  materials: CatalogMaterial[];
}

const ease = [0.22, 1, 0.36, 1] as const;

export function ProductsPageClient({ products, materials }: ProductsPageClientProps) {
  const { t } = useLanguage();

  const items = [
    ...materials.map((m) => ({
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
    ...products.map((p) => ({
      key: `prod-${p.id}`,
      href: `/products/${p.id}`,
      imageSrc: p.image,
      hex: undefined,
      code: p.productCode ?? p.id,
      title: p.name,
      subtitle: p.category,
      meta: p.surfaceFinish,
    })),
  ];

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
        {items.length === 0 ? (
          <p className="border border-divider bg-marble p-10 text-center text-muted">
            {t("emptyProducts")}
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
                  thumbSrc={"thumbSrc" in item ? item.thumbSrc : undefined}
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
      </section>
    </div>
  );
}
