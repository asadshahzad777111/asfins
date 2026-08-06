"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { parseSeriesFromDescription, resolveSheetRate, formatPKR } from "@/lib/rates";
import { StockRateBadge } from "@/components/StockRateBadge";
import { useCart } from "@/lib/cart/CartContext";
import {
  isSheetCategory,
  unitLabelForCategory,
} from "@/lib/products/categories";
import { whatsappUrl } from "@/lib/share";
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
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const series =
    product.materialCategory ?? parseSeriesFromDescription(product.description);
  const rate = resolveSheetRate({
    pricePKR: product.pricePKR,
    materialCategory: series,
    substrate: product.substrate,
    description: product.description,
  });
  const displayRate = rate ?? product.pricePKR;
  const sheet = isSheetCategory(product.category);

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

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      pricePKR: displayRate,
      image: product.image,
      category: product.category,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  const waMsg = [
    `Hi ASFins — I want to order:`,
    `${product.name}`,
    product.productCode ? `Code: ${product.productCode}` : null,
    `Rate: ${formatPKR(displayRate)}`,
  ]
    .filter(Boolean)
    .join("\n");

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
            className="overflow-hidden border border-divider bg-white"
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
                rate={displayRate}
                stock={product.stock}
                lowStockAt={product.lowStockAt}
              />
              <p className="mt-1 font-mono-data text-[10px] uppercase tracking-wider text-muted">
                {t(unitLabelForCategory(product.category))}
              </p>
            </div>

            {product.description && (
              <p className="mt-6 leading-relaxed text-muted">{product.description}</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAdd}
                className="bg-ink px-6 py-3 text-sm text-paper transition-opacity hover:opacity-85"
              >
                {added ? t("addedToCart") : t("addToCart")}
              </button>
              <Link
                href="/cart"
                className="border border-ink/20 px-6 py-3 text-sm text-ink hover:border-ink/40"
              >
                {t("viewCart")}
              </Link>
              <a
                href={whatsappUrl(waMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-ink/20 px-6 py-3 text-sm text-ink hover:border-ink/40"
              >
                {t("orderOnWhatsApp")}
              </a>
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

            {!sheet && (
              <p className="mt-8 text-sm text-muted">{t("accessoryOrderHint")}</p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
