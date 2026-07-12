"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { StickyWhatsAppButton } from "@/components/StickyWhatsAppButton";
import { FinishMarquee } from "@/components/FinishMarquee";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { Reveal, SplitLines } from "@/components/motion/Reveal";

const ease = [0.22, 1, 0.36, 1] as const;

const CATALOGS = [
  { name: "Patex", meta: "Laminate · sheets" },
  { name: "ZRK", meta: "MDF · finishes" },
  { name: "Partner dealers", meta: "Lahore network" },
] as const;

export function StudioLandingClient() {
  const { t } = useLanguage();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.18]);
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <div className="loco-page">
      <nav className="loco-nav" aria-label="Primary">
        <Link href="/studio" className="font-display text-lg tracking-tight sm:text-xl">
          {SHOP.name}
          <span className="align-super text-[0.55em]">®</span>
        </Link>
        <div className="flex items-center gap-5 sm:gap-8">
          <Link
            href="/gallery"
            className="nav-underline hidden text-[13px] sm:inline"
          >
            {t("studioGuide")}
          </Link>
          <Link
            href="/products"
            className="nav-underline hidden text-[13px] md:inline"
          >
            {t("products")}
          </Link>
          <Link
            href="/about"
            className="nav-underline hidden text-[13px] lg:inline"
          >
            {t("about")}
          </Link>
          <Link
            href="/contact"
            className="nav-underline hidden text-[13px] lg:inline"
          >
            {t("contact")}
          </Link>
          <LanguageSwitcher variant="dark" />
        </div>
      </nav>

      {/* Full-bleed hero */}
      <section ref={heroRef} className="loco-hero">
        <div className="loco-hero__media">
          <motion.img
            src="/scenes/kitchen-modern/base.jpg"
            alt=""
            style={{ scale: heroScale, y: heroY }}
            className="h-full w-full object-cover"
            decoding="async"
          />
        </div>
        <div className="loco-hero__veil" aria-hidden />
        <div className="loco-hero__copy">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="mb-4 text-[13px] tracking-[0.08em]"
          >
            {SHOP.legalName} · {SHOP.city}
          </motion.p>
          <h1 className="text-display">
            <span className="block overflow-hidden">
              <motion.span
                className="block"
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease }}
              >
                {SHOP.name}
                <span className="align-super text-[0.35em]">®</span>
              </motion.span>
            </span>
            <span className="mt-1 block overflow-hidden">
              <motion.span
                className="block text-heading-lg opacity-90"
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, delay: 0.12, ease }}
              >
                {t("studioHeroLine1")}
              </motion.span>
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7, ease }}
            className="mt-5 max-w-md text-[15px] leading-relaxed text-paper/80"
          >
            {t("vdsTagline")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease }}
            className="mt-8 flex flex-wrap items-center gap-6"
          >
            <Link
              href="/gallery/kitchen"
              className="inline-flex items-center gap-3 border border-paper bg-paper px-7 py-3.5 text-[13px] text-ink transition-opacity hover:opacity-80"
            >
              {t("enterStudio")}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/products"
              className="nav-underline text-[13px] text-paper"
            >
              {t("products")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Featured exhibit */}
      <section className="section-pad border-b border-ink">
        <div className="px-[clamp(1.25rem,4vw,2.5rem)]">
          <Reveal>
            <p className="text-[13px] tracking-[0.12em] uppercase text-muted">
              {t("featuredWork")}
            </p>
            <SplitLines
              as="h2"
              className="text-heading-lg mt-4 max-w-3xl"
              text={t("featuredWorkTitle")}
              delay={0.05}
            />
          </Reveal>
        </div>

        <div className="loco-feature mt-10">
          <p className="loco-feature__label loco-feature__label--tl">
            {t("featureLabelTl")}
          </p>
          <p className="loco-feature__label loco-feature__label--tr">
            {t("featureLabelTr")}
          </p>
          <Reveal y={40}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/scenes/kitchen-1/base.jpg"
              alt=""
              className="loco-feature__img"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
          <p className="loco-feature__label loco-feature__label--bl">
            {t("featureLabelBl")}
          </p>
          <p className="loco-feature__label loco-feature__label--br">
            {t("featureLabelBr")}
          </p>
        </div>
      </section>

      {/* Manifesto — inverted */}
      <section className="loco-invert section-pad px-[clamp(1.25rem,4vw,2.5rem)]">
        <Reveal>
          <p className="max-w-3xl text-heading-sm leading-snug">
            {t("manifesto")}
          </p>
          <p className="mt-10 text-[13px] tracking-[0.08em] text-paper/50">
            {t("atelierMark")} · © {new Date().getFullYear()}
          </p>
        </Reveal>
      </section>

      {/* Before / after */}
      <section className="section-pad px-[clamp(1.25rem,4vw,2.5rem)]">
        <Reveal className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] tracking-[0.12em] uppercase text-muted">
              {t("atelierCompareHint")}
            </p>
            <h2 className="text-heading-lg mt-3 max-w-xl">{t("compareTitle")}</h2>
          </div>
          <Link
            href="/gallery/kitchen"
            className="nav-underline shrink-0 text-[13px]"
          >
            {t("enterStudio")} →
          </Link>
        </Reveal>
        <Reveal y={36}>
          <BeforeAfterSlider
            beforeSrc="/scenes/kitchen-modern/base.jpg"
            afterSrc="/scenes/kitchen-1/base.jpg"
            beforeLabel={t("beforeLabel")}
            afterLabel={t("afterLabel")}
            hint={t("dragToCompare")}
            autoPlay
            className="aspect-[16/10] w-full"
          />
        </Reveal>
      </section>

      <FinishMarquee className="border-ink/20 text-ink" />

      {/* Process as editorial rows */}
      <section className="section-pad px-[clamp(1.25rem,4vw,2.5rem)]">
        <Reveal>
          <h2 className="text-heading-lg max-w-2xl">{t("processTitle")}</h2>
        </Reveal>
        <ul className="mt-12 border-t border-ink">
          {(
            [
              { k: "atelierStep1Title", d: "atelierStep1Desc" },
              { k: "atelierStep2Title", d: "atelierStep2Desc" },
              { k: "atelierStep3Title", d: "atelierStep3Desc" },
            ] as const satisfies ReadonlyArray<{ k: TranslationKey; d: TranslationKey }>
          ).map((step, i) => (
            <Reveal key={step.k} delay={i * 0.08}>
              <li className="loco-row group">
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-10">
                  <span className="w-10 shrink-0 text-[13px] text-muted">
                    0{i + 1}
                  </span>
                  <span className="text-heading-sm">{t(step.k)}</span>
                  <span className="text-[15px] text-muted sm:ml-auto sm:max-w-sm sm:text-right">
                    {t(step.d)}
                  </span>
                </div>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Catalogs */}
      <section className="loco-invert section-pad px-[clamp(1.25rem,4vw,2.5rem)]">
        <Reveal className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] tracking-[0.12em] uppercase text-paper/45">
              {t("catalogsLabel")}
            </p>
            <h2 className="text-heading-lg mt-3">{t("catalogsTitle")}</h2>
          </div>
          <Link href="/products" className="nav-underline text-[13px] text-paper">
            {t("allWork")} →
          </Link>
        </Reveal>
        <div className="border-t border-paper/30">
          {CATALOGS.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.06}>
              <Link href="/products" className="loco-row border-paper/30 text-paper">
                <span className="text-heading-sm">{c.name}</span>
                <span className="text-[13px] text-paper/50">{c.meta}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="section-pad px-[clamp(1.25rem,4vw,2.5rem)] text-center">
        <Reveal>
          <p className="text-[13px] tracking-[0.12em] uppercase text-muted">
            {t("atelierMark")}
          </p>
          <h2 className="text-display mx-auto mt-6 max-w-4xl">
            {t("closingCta")}
          </h2>
          <Link
            href="/gallery/kitchen"
            className="mt-10 inline-flex items-center gap-3 bg-ink px-8 py-4 text-[13px] text-paper transition-opacity hover:opacity-80"
          >
            {t("enterStudio")}
            <span aria-hidden>→</span>
          </Link>
        </Reveal>
      </section>

      <footer className="loco-invert border-t border-paper/20 px-[clamp(1.25rem,4vw,2.5rem)] py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-xl">
            {SHOP.name}
            <span className="align-super text-[0.5em]">®</span>
          </p>
          <div className="flex flex-wrap gap-6 text-[13px] text-paper/60">
            <Link href="/gallery" className="hover:text-paper">
              {t("gallery")}
            </Link>
            <Link href="/products" className="hover:text-paper">
              {t("products")}
            </Link>
            <Link href="/about" className="hover:text-paper">
              {t("about")}
            </Link>
            <Link href="/contact" className="hover:text-paper">
              {t("contact")}
            </Link>
            <Link href="/studio/kitchen" className="hover:text-paper">
              {t("enterStudio")}
            </Link>
          </div>
        </div>
        <p className="mt-6 text-[12px] text-paper/35">
          © {new Date().getFullYear()} {SHOP.name} · {SHOP.legalName} · {t("madeInPakistan")}
        </p>
      </footer>
      <StickyWhatsAppButton />
    </div>
  );
}
