"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { formatPKR } from "@/lib/rates";
import { SHOP } from "@/lib/constants";
import { SwatchThumb } from "@/components/SwatchThumb";
import type { CatalogMaterial } from "@/lib/catalogs/materials";

interface MaterialDetailClientProps {
  material: CatalogMaterial;
}

export function MaterialDetailClient({ material }: MaterialDetailClientProps) {
  const { t } = useLanguage();
  const { swatch, catalogName, catalogId } = material;

  const specs = [
    { label: t("productCode"), value: swatch.sheetCode },
    { label: t("surfaceFinish"), value: swatch.surfaceFinish },
    { label: t("colorDescription"), value: swatch.colorDescription },
    { label: t("dimensions"), value: swatch.dimensions },
    { label: t("thickness"), value: swatch.thickness },
    { label: t("brandName"), value: catalogName },
  ].filter((s) => s.value);

  const imageSrc = swatch.imageUrl ?? undefined;
  const whatsappDealer = `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(
    `Hi, I'm interested in sheet ${swatch.sheetCode} (${swatch.name}) from ${catalogName}. Please connect me with a dealer.`
  )}`;

  const categoryLabel =
    swatch.materialCategory ??
    (swatch.palette === "wood"
      ? t("paletteWoodLaminate")
      : swatch.palette === "tile"
        ? t("paletteTile")
        : t("palettePaint"));

  const desc =
    swatch.description ??
    (swatch.surfaceFinish && swatch.colorDescription
      ? `A ${categoryLabel} product with a ${swatch.surfaceFinish} surface, featuring a ${swatch.colorDescription} color tone.`
      : undefined);

  return (
    <div className="bg-marble">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <nav className="font-mono-data text-xs text-muted">
          <Link href="/" className="hover:text-brass">
            {t("home")}
          </Link>
          <span className="mx-2">/</span>
          <Link href="/products" className="hover:text-brass">
            {t("products")}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{categoryLabel}</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden border border-divider bg-white shadow-sm"
          >
            {imageSrc || swatch.thumbUrl ? (
              <div className="relative aspect-square w-full">
                <SwatchThumb
                  hex={swatch.hex}
                  imageUrl={imageSrc}
                  thumbUrl={swatch.thumbUrl}
                  name={swatch.name}
                  className="h-full w-full"
                  rounded="none"
                  preferFull
                  priority
                />
              </div>
            ) : (
              <div
                className="aspect-square w-full"
                style={{ backgroundColor: swatch.hex }}
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="inline-block border border-brass/30 bg-brass/10 px-2.5 py-1 font-mono-data text-[10px] uppercase tracking-[0.2em] text-brass">
              {categoryLabel}
            </span>
            <h1 className="font-display mt-4 text-3xl text-charcoal sm:text-4xl">
              {swatch.name}
            </h1>
            <p className="font-mono-data mt-2 text-lg text-muted">{swatch.sheetCode}</p>
            {(swatch.pricePKR ?? 0) > 0 && (
              <p className="font-mono-data mt-3 text-lg text-brass">
                {formatPKR(swatch.pricePKR!)}{" "}
                <span className="text-sm text-muted">{t("perSheet")}</span>
              </p>
            )}

            {desc && <p className="mt-6 leading-relaxed text-muted">{desc}</p>}

            <div className="mt-8 flex flex-wrap gap-3">
              {swatch.technicalSheetUrl && (
                <a
                  href={swatch.technicalSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-technical"
                >
                  {t("technicalSheet")} ↓
                </a>
              )}
              <a
                href={whatsappDealer}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                {t("findDealer")} →
              </a>
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
                      <tr key={spec.label}>
                        <th>{spec.label}</th>
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
          className="vds-cta relative mt-16 px-8 py-10 sm:px-12"
        >
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="h-14 w-14 shrink-0 border border-divider"
                style={{
                  backgroundColor: swatch.hex,
                  backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
                  backgroundSize: "cover",
                }}
              />
              <div>
                <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
                  {t("virtualDesignStudio")}
                </p>
                <h2 className="font-display mt-1 text-xl text-marble sm:text-2xl">
                  {t("visualizeYourDreams")}
                </h2>
              </div>
            </div>
            <Link
              href="/gallery/kitchen"
              className="btn-primary shrink-0 self-start sm:self-center"
            >
              {t("startVisualizing")} →
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
