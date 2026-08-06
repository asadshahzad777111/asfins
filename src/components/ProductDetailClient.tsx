"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { parseSeriesFromDescription, resolveSheetRate, formatPKR } from "@/lib/rates";
import { useCart } from "@/lib/cart/CartContext";
import {
  isSheetCategory,
  unitLabelForCategory,
} from "@/lib/products/categories";
import { productCatalogLabel } from "@/lib/products/shop-catalogs";
import { getStockStatus, stockStatusLabelKey } from "@/lib/stock";
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
  const code = (product.productCode || "").trim();
  const catalogLabel = sheet ? productCatalogLabel(product) : product.brandName;
  const unitKey = unitLabelForCategory(product.category);
  const stock = getStockStatus(product.stock, product.lowStockAt);

  const substrateLabel =
    product.substrate === "mdf"
      ? t("substrateMdf")
      : product.substrate === "chipboard"
        ? t("substrateChipboard")
        : undefined;

  const specs = (
    [
      { labelKey: "productCode" as const, value: code || undefined },
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
      name: code ? `${code} — ${product.name}` : product.name,
      pricePKR: displayRate,
      image: product.image,
      category: product.category,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  const waMsg = [
    `Hi ASFins — I want to order:`,
    code ? `Code: ${code}` : null,
    `${product.name}`,
    `Rate: ${formatPKR(displayRate)}`,
    typeof product.stock === "number" ? `Stock: ${product.stock}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="bg-paper pb-mobile-nav">
      <div className="mx-auto w-full max-w-[1440px] md:px-16 md:pb-28">
        <div className="grid min-h-[70vh] grid-cols-1 md:grid-cols-12 md:gap-6">
          {/* Image canvas */}
          <div className="relative overflow-hidden border-b border-stone bg-[#f3f3f3] md:col-span-8 md:min-h-[80vh] md:border-b-0 md:border-r">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={code ? `${code} — ${product.name}` : product.name}
              className="h-full min-h-[50vh] w-full object-cover md:absolute md:inset-0 md:min-h-0"
            />
            <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2 md:left-8 md:top-8">
              {catalogLabel && (
                <span className="label-caps border border-stone bg-white/80 px-3 py-1 text-ink backdrop-blur-sm">
                  {catalogLabel}
                </span>
              )}
              <span className="label-caps border border-brass bg-white/80 px-3 py-1 text-brass backdrop-blur-sm">
                {t(stockStatusLabelKey(stock))}
              </span>
            </div>
          </div>

          {/* Details pane */}
          <div className="flex flex-col justify-center px-5 py-10 md:col-span-4 md:p-8">
            <Link
              href="/products"
              className="label-caps mb-6 text-muted transition-colors hover:text-ink"
            >
              ← {t("allProducts")}
            </Link>

            {series && (
              <p className="label-caps text-muted">{series}</p>
            )}

            <h1 className="font-display mt-2 text-[40px] leading-tight tracking-tight text-ink md:text-[56px]">
              {code || product.name}
            </h1>

            {code && (
              <p className="mt-2 font-display text-xl text-charcoal">{product.name}</p>
            )}

            {product.description && (
              <p className="mt-4 text-lg leading-relaxed text-[#4c4546]">
                {product.description}
              </p>
            )}

            <div className="mt-8 flex items-end justify-between border-y border-stone py-6">
              <div>
                <span className="label-caps mb-1 block text-muted">
                  {t("lahoreDepotRate")}
                </span>
                <span className="font-display text-[28px] text-ink md:text-[32px]">
                  {displayRate != null && displayRate > 0
                    ? formatPKR(displayRate)
                    : t("ratesComingSoon")}
                  {displayRate != null && displayRate > 0 && (
                    <span className="ml-2 text-base text-muted">
                      / {t(unitKey)}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-right">
                <span className="label-caps mb-1 block text-muted">
                  {t("availability")}
                </span>
                <span className="text-lg font-semibold text-ink">
                  {typeof product.stock === "number"
                    ? product.stock
                    : t(stockStatusLabelKey(stock))}
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <button type="button" onClick={handleAdd} className="btn-atelier w-full">
                {added ? t("addedToCart") : t("addToCart")}
              </button>
              <a
                href={whatsappUrl(waMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 border border-brass py-4 label-caps text-brass transition-colors hover:bg-brass hover:text-white"
              >
                {t("orderOnWhatsApp")}
              </a>
              <Link
                href="/cart"
                className="btn-atelier-outline w-full text-center"
              >
                {t("viewCart")}
              </Link>
              {product.technicalSheetUrl && (
                <a
                  href={product.technicalSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label-caps text-center text-muted hover:text-ink"
                >
                  {t("technicalSheet")} ↓
                </a>
              )}
            </div>

            {!sheet && (
              <p className="mt-8 text-sm text-muted">{t("accessoryOrderHint")}</p>
            )}
          </div>
        </div>

        {/* Specs */}
        {specs.length > 0 && (
          <section className="mt-16 px-5 md:mt-28 md:px-0">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              <div className="border-t border-stone pt-4 md:col-span-4">
                <h2 className="font-display text-[28px] text-ink md:text-[32px]">
                  {t("productSpecs").replace(" ", "\n").includes("\n")
                    ? t("productSpecs")
                    : t("productSpecs")}
                </h2>
              </div>
              <ul className="border-t border-stone md:col-span-8">
                {specs.map((spec) => (
                  <li
                    key={spec.labelKey + (spec.value ?? "")}
                    className="flex items-center justify-between gap-4 border-b border-stone py-6"
                  >
                    <span className="text-lg text-muted">
                      {spec.labelKey === "substrateMdf" ||
                      spec.labelKey === "substrateChipboard"
                        ? t("substrate")
                        : t(spec.labelKey)}
                    </span>
                    <span
                      className={`text-right text-lg text-ink ${
                        spec.labelKey === "productCode"
                          ? "font-mono-data tracking-wide"
                          : ""
                      }`}
                    >
                      {spec.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
