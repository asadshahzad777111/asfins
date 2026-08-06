"use client";

import Link from "next/link";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { formatPKR, resolveSheetRate } from "@/lib/rates";
import { unitLabelForCategory } from "@/lib/products/categories";
import type { Product } from "@/lib/products/types";
import { Reveal } from "@/components/motion/Reveal";

interface HomePageClientProps {
  featured: Product[];
}

export function HomePageClient({ featured }: HomePageClientProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-marble">
      <section className="relative overflow-hidden border-b border-divider">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(184,149,90,0.18), transparent 55%), linear-gradient(165deg, #f7f3ec 0%, #ebe4d8 45%, #e2d8c8 100%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
              {SHOP.name} · {SHOP.city}
            </p>
            <h1 className="font-display mt-4 text-4xl leading-tight tracking-tight text-charcoal sm:text-6xl">
              {t("homeTitle")}
              <br />
              <span className="text-brass">{t("homeTitleAccent")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              {t("homeSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="bg-ink px-6 py-3 text-sm text-paper transition-opacity hover:opacity-85"
              >
                {t("browseShop")}
              </Link>
              <Link
                href="/contact"
                className="border border-ink/20 px-6 py-3 text-sm text-ink hover:border-ink/40"
              >
                {t("contact")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <Reveal>
          <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
            {t("shopEyebrow")}
          </p>
          <h2 className="font-display mt-3 text-3xl text-charcoal">
            {t("featuredProducts")}
          </h2>
          <p className="mt-2 max-w-lg text-muted">{t("featuredProductsSubtitle")}</p>
        </Reveal>

        {featured.length === 0 ? (
          <p className="mt-10 border border-divider bg-paper p-8 text-center text-muted">
            {t("emptyProducts")}
          </p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => {
              const rate = resolveSheetRate({
                pricePKR: p.pricePKR,
                materialCategory: p.materialCategory,
                substrate: p.substrate,
                description: p.description,
              });
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group border border-divider bg-paper transition-colors hover:border-ink/30"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-base">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.productCode ? `${p.productCode} — ${p.name}` : p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    {p.productCode && (
                      <div className="absolute left-2 top-2 border border-ink/15 bg-paper/95 px-2.5 py-1.5 backdrop-blur-sm">
                        <p className="font-mono-data text-base tracking-wide text-ink">
                          {p.productCode}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    {p.productCode && (
                      <p className="font-mono-data text-sm text-ink">
                        {t("codeShort")}: {p.productCode}
                      </p>
                    )}
                    <h3 className="font-display mt-1 text-lg text-charcoal">{p.name}</h3>
                    <p className="mt-2 font-mono-data text-sm text-ink">
                      {rate != null ? formatPKR(rate) : t("ratesComingSoon")}
                      {rate != null && (
                        <span className="ml-1 text-[10px] uppercase text-muted">
                          {t(unitLabelForCategory(p.category))}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-block border border-ink px-6 py-3 text-sm text-ink hover:bg-ink hover:text-paper"
          >
            {t("viewAllProducts")}
          </Link>
        </div>
      </section>
    </div>
  );
}
