"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { formatPKR } from "@/lib/rates";
import { SHOP } from "@/lib/constants";
import type { Product } from "@/lib/products/types";

interface ProductDetailClientProps {
  product: Product;
}

interface SpecRow {
  labelKey: "productCode" | "surfaceFinish" | "colorDescription" | "dimensions" | "thickness" | "idealApplications" | "brandName";
  value: string | undefined;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const { t } = useLanguage();

  const specs = (
    [
      { labelKey: "productCode" as const, value: product.productCode },
      { labelKey: "surfaceFinish" as const, value: product.surfaceFinish },
      { labelKey: "colorDescription" as const, value: product.colorDescription },
      { labelKey: "dimensions" as const, value: product.dimensions },
      { labelKey: "thickness" as const, value: product.thickness },
      { labelKey: "idealApplications" as const, value: product.idealApplications },
      { labelKey: "brandName" as const, value: product.brandName },
    ] as SpecRow[]
  ).filter((s) => s.value);

  const whatsappDealer = `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(
    `Hi, I'm interested in product ${product.productCode ?? product.name}. Please connect me with a dealer.`
  )}`;

  return (
    <div className="bg-marble">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/products" className="font-mono-data text-xs text-brass hover:underline">
          {t("allProducts")}
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Product image */}
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

          {/* Product details */}
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
            <h1 className="font-display mt-2 text-3xl text-charcoal sm:text-4xl">
              {product.name}
            </h1>
            <p className="font-mono-data mt-3 text-lg text-brass">
              {formatPKR(product.pricePKR)}{" "}
              <span className="text-sm text-muted">{t("perSheet")}</span>
            </p>

            {product.description && (
              <p className="mt-6 leading-relaxed text-muted">{product.description}</p>
            )}

            {/* Action buttons */}
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
              <a href={whatsappDealer} target="_blank" rel="noopener noreferrer" className="btn-outline">
                {t("findDealer")}
              </a>
              <Link href="/gallery/kitchen" className="btn-primary">
                {t("visualizeThis")}
              </Link>
            </div>

            {/* Spec table */}
            {specs.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display text-lg text-charcoal">{t("productSpecs")}</h2>
                <table className="spec-table mt-4">
                  <tbody>
                    {specs.map((spec) => (
                      <tr key={spec.labelKey}>
                        <th>{t(spec.labelKey)}</th>
                        <td>{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>

        {/* VDS CTA */}
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
