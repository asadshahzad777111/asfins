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

const COLLECTIONS = [
  {
    id: "sheets",
    href: "/products?filter=sheets",
    title: "Sheets",
    subtitle: "Explore High-Pressure Laminates",
    image: "/marketing/collection-sheets.webp",
    span: "md:col-span-8 md:row-span-2",
    soon: false,
  },
  {
    id: "hardware",
    href: "/products?filter=hardware",
    title: "Hardware",
    subtitle: "Precision Fittings",
    image: "/marketing/collection-hardware.webp",
    span: "md:col-span-4",
    soon: false,
  },
  {
    id: "surfaces",
    href: "/products?filter=sheets",
    title: "Wall & Ceiling",
    subtitle: "Surfaces · Sheets catalog",
    image: "/marketing/collection-wall.webp",
    span: "md:col-span-4",
    soon: false,
  },
  {
    id: "floor",
    href: "#",
    title: "Floor",
    subtitle: "Coming Soon",
    image: "/marketing/collection-floor.webp",
    span: "md:col-span-6",
    soon: true,
  },
  {
    id: "decor",
    href: "#",
    title: "Decor",
    subtitle: "Coming Soon",
    image: "/marketing/collection-decor.webp",
    span: "md:col-span-6",
    soon: true,
  },
] as const;

export function HomePageClient({ featured }: HomePageClientProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-paper pb-mobile-nav">
      {/* Desktop / tablet full-bleed hero */}
      <section className="relative hidden min-h-[600px] w-full flex-col justify-end overflow-hidden bg-ink px-5 pb-10 md:flex md:h-[90vh] md:px-16 md:pb-16">
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/hero-kitchen.webp"
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col items-end justify-between gap-8 md:flex-row">
          <div className="max-w-2xl text-white">
            <h1 className="font-display text-[40px] leading-[1.15] tracking-[-0.02em] text-white md:text-[64px] md:leading-[1.1]">
              {t("homeHeroTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/90">
              {t("homeHeroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href="/products?filter=sheets" className="btn-atelier text-center">
                {t("shopSheets")}
              </Link>
              <Link
                href="/products?filter=hardware"
                className="btn-atelier-ghost text-center"
              >
                {t("browseHardware")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile typography-first hero (Stitch zip3) */}
      <section className="flex min-h-[72vh] flex-col justify-center px-5 py-16 md:hidden">
        <h1 className="font-display max-w-[12ch] text-[40px] leading-tight tracking-tight text-ink">
          {t("homeHeroTitle")}
        </h1>
        <p className="mt-8 max-w-md text-base leading-relaxed text-muted">
          {t("homeHeroSubtitleMobile")}
        </p>
        <div className="mt-12 flex w-full flex-col gap-4">
          <Link href="/products" className="btn-atelier w-full text-center">
            {t("exploreCollections")}
          </Link>
          <Link href="/contact" className="btn-atelier-outline w-full text-center">
            {t("bookConsultation")}
          </Link>
        </div>
      </section>

      {/* Curated collections */}
      <section className="mx-auto w-full max-w-[1440px] px-5 py-20 md:px-16 md:py-40">
        <Reveal>
          <h2 className="font-display text-[28px] text-ink md:text-[32px]">
            {t("curatedCollections")}
          </h2>
        </Reveal>

        <div className="mt-10 grid auto-rows-[320px] grid-cols-1 gap-6 md:mt-16 md:auto-rows-[400px] md:grid-cols-12">
          {COLLECTIONS.map((c) =>
            c.soon ? (
              <div
                key={c.id}
                className={`relative col-span-1 flex items-center justify-center overflow-hidden border border-stone bg-[#f3f3f3] ${c.span}`}
              >
                <div className="absolute inset-0 opacity-20 grayscale">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="relative z-10 p-8 text-center">
                  <div className="mb-4 inline-block border border-brass px-3 py-1">
                    <span className="label-caps text-brass">{t("comingSoon")}</span>
                  </div>
                  <h3 className="font-display text-[28px] text-ink md:text-[32px]">
                    {c.title}
                  </h3>
                </div>
              </div>
            ) : (
              <Link
                key={c.id}
                href={c.href}
                className={`group relative col-span-1 block overflow-hidden border border-stone ${c.span}`}
              >
                <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image}
                    alt={c.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/10 transition-colors duration-500 group-hover:bg-black/0" />
                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/60 to-transparent p-6 md:p-8">
                  <h3 className="font-display text-[28px] text-white md:text-[32px]">
                    {c.title}
                  </h3>
                  <p className="label-caps mt-2 translate-y-2 text-white/80 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
                    {c.subtitle}
                  </p>
                </div>
              </Link>
            )
          )}
        </div>
      </section>

      {/* Featured products — keep shop backend visibility */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-[1440px] border-t border-stone px-5 py-20 md:px-16 md:py-28">
          <Reveal>
            <p className="label-caps text-brass">{t("shopEyebrow")}</p>
            <h2 className="font-display mt-3 text-[28px] text-ink md:text-[32px]">
              {t("featuredProducts")}
            </h2>
            <p className="mt-2 max-w-lg text-muted">{t("featuredProductsSubtitle")}</p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => {
              const rate = resolveSheetRate({
                pricePKR: p.pricePKR,
                materialCategory: p.materialCategory,
                substrate: p.substrate,
                description: p.description,
              });
              const code = (p.productCode || "").trim();
              const series = (p.materialCategory || "").trim();
              const finish = (p.surfaceFinish || "").trim();
              const overlayLine = [series, finish]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(" · ");
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group flex flex-col border border-stone bg-base transition-colors hover:border-ink"
                >
                  <div className="relative aspect-square overflow-hidden bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={code ? `${code} — ${p.name}` : p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-0 bg-ink/75 px-3 py-3 text-white transition-transform duration-300 ease-out [@media(hover:hover)]:translate-y-full [@media(hover:hover)]:group-hover:translate-y-0">
                      <p className="font-display text-sm leading-snug sm:text-base">
                        {p.name}
                      </p>
                      {overlayLine && (
                        <p className="label-caps mt-1 text-[10px] text-white/75">
                          {overlayLine}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
                    {code && (
                      <p className="font-mono-data text-lg font-semibold tracking-wide text-ink sm:text-xl">
                        {code}
                      </p>
                    )}
                    <p className="mt-1 font-mono-data text-sm text-ink">
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

          <div className="mt-10 text-center">
            <Link href="/products" className="btn-atelier-outline">
              {t("viewAllProducts")}
            </Link>
          </div>
        </section>
      )}

      {/* Philosophy */}
      <section className="border-t border-stone px-5 py-20 md:px-16 md:py-24">
        <div className="mx-auto max-w-[1440px]">
          <span className="label-caps block text-muted">{t("philosophyLabel")}</span>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink">
            {t("philosophyBody")}
          </p>
          <p className="mt-6 label-caps text-muted">
            {SHOP.name} · {SHOP.city}
          </p>
        </div>
      </section>
    </div>
  );
}
