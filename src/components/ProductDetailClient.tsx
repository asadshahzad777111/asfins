"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { parseSeriesFromDescription, resolveSheetRate } from "@/lib/rates";
import { StockRateBadge } from "@/components/StockRateBadge";
import type { Product } from "@/lib/products/types";

interface ProductDetailClientProps {
  product: Product;
}

interface SpecRow {
  labelKey:
    | "productCode"
    | "surfaceFinish"
    | "colorDescription"
    | "dimensions"
    | "thickness"
    | "idealApplications"
    | "brandName"
    | "substrateMdf"
    | "substrateChipboard";
  value: string | undefined;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const { t } = useLanguage();

  const series =
    product.materialCategory ?? parseSeriesFromDescription(product.description);
  const rate = resolveSheetRate({
    pricePKR: product.pricePKR,
    materialCategory: series,
    substrate: product.substrate,
    description: product.description,
  });

  const substrateLabel =
    product.substrate === "mdf"
      ? t("substrateMdf")
      : product.substrate === "chipboard"
        ? t("substrateChipboard")
        : undefined;

  const specs = (
    [
      { labelKey: "productCode" as const, value: product.productCode },
      { labelKey: "surfaceFinish" as const, value: product.surfaceFinish },
      { labelKey: "colorDescription" as const, value: product.colorDescription },
      { labelKey: "dimensions" as const, value: product.dimensions },
      { labelKey: "thickness" as const, value: product.thickness },
      { labelKey: "idealApplications" as const, value: product.idealApplications },
      { labelKey: "brandName" as const, value: product.brandName },
      {
        labelKey: (product.substrate === "chipboard"
          ? "substrateChipboard"
          : "substrateMdf") as SpecRow["labelKey"],
        value: substrateLabel,
      },
    ] as SpecRow[]
  ).filter((s) => s.value);

  return (
    <div className="bg-marble">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/products" className="font-mono-data text-xs text-brass hover:underline">
          {t("allProducts")}
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-sm border border-divider bg-white shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.name}
              className="aspect-square w-full object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {product.brandName && (
              <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
                {product.brandName}
              </p>
            )}
            {series && (
              <p className="mt-1 font-mono-data text-[10px] uppercase tracking-wider text-muted">
                {series}
              </p>
            )}
            <h1 className="font-display mt-2 text-3xl text-charcoal sm:text-4xl">
              {product.name}
            </h1>

            <div className="mt-5">
              <StockRateBadge
                rate={rate}
                stock={product.stock}
                lowStockAt={product.lowStockAt}
              />
            </div>

            {product.description && (
              <p className="mt-6 leading-relaxed text-muted">{product.description}</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {product.technicalSheetUrl && (
                <a
                  href={product.technicalSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-technical"
                >
                  {t("technicalSheet")} ↓
                </a>
              )}
              <Link href="/gallery/kitchen" className="btn-primary">
                {t("visualizeThis")}
              </Link>
            </div>

            {specs.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display text-lg text-charcoal">{t("productSpecs")}</h2>
                <table className="spec-table mt-4">
                  <tbody>
                    {specs.map((spec) => (
                      <tr key={spec.labelKey + (spec.value ?? "")}>
                        <th>
                          {spec.labelKey === "substrateMdf" ||
                          spec.labelKey === "substrateChipboard"
                            ? t("substrate")
                            : t(spec.labelKey)}
                        </th>
                        <td>{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="vds-cta relative mt-16 px-8 py-10 sm:px-12"
        >
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
                {t("colorVisualizer")}
              </p>
              <h2 className="font-display mt-2 text-xl text-marble sm:text-2xl">
                {t("virtualDesignStudio")}
              </h2>
              <p className="mt-2 max-w-md text-sm text-marble/75">
                {t("virtualDesignStudioDesc")}
              </p>
            </div>
            <Link href="/gallery/kitchen" className="btn-primary shrink-0 self-start sm:self-center">
              {t("startVisualizing")}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
