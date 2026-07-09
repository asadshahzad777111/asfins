"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { FinishMarquee } from "@/components/FinishMarquee";
import { StickyAtelierCTA } from "@/components/StickyAtelierCTA";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

const ease = [0.22, 1, 0.36, 1] as const;

export function StudioLandingClient() {
  const { t } = useLanguage();

  return (
    <div className="atelier-landing atelier-grain relative flex min-h-screen flex-col overflow-hidden">
      <div className="atelier-landing__mesh" aria-hidden />
      <div className="atelier-landing__beams" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="atelier-landing__beam" />
        ))}
      </div>
      <div className="atelier-landing__orb atelier-landing__orb--a" aria-hidden />
      <div className="atelier-landing__orb atelier-landing__orb--b" aria-hidden />
      <div className="atelier-landing__orb atelier-landing__orb--c" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/studio" className="group shrink-0">
          <p className="atelier-brand-glow font-display text-xl leading-none tracking-tight text-marble transition-colors group-hover:text-brass sm:text-2xl">
            {SHOP.name}
          </p>
          <p className="font-mono-data mt-1 text-[9px] uppercase tracking-[0.28em] text-marble/45">
            {t("atelierMark")} · {SHOP.city}
          </p>
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/gallery"
            className="nav-underline hidden font-mono-data text-[10px] uppercase tracking-[0.22em] text-marble/55 transition-colors hover:text-brass sm:block"
          >
            {t("studioGuide")}
          </Link>
          <Link
            href="/products"
            className="nav-underline hidden font-mono-data text-[10px] uppercase tracking-[0.22em] text-marble/55 transition-colors hover:text-brass md:block"
          >
            {t("products")}
          </Link>
          <LanguageSwitcher variant="dark" />
        </div>
      </header>

      {/* ZRK-style portal hero — full viewport centre */}
      <section className="relative z-10 flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-6 pb-16 pt-8 text-center sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="max-w-3xl"
        >
          <motion.p
            initial={{ opacity: 0, letterSpacing: "0.5em" }}
            animate={{ opacity: 1, letterSpacing: "0.28em" }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="font-mono-data text-[10px] uppercase text-marble/50"
          >
            {SHOP.name}
          </motion.p>

          <h1 className="atelier-vds-title mt-6">
            <motion.span
              className="block"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.75, ease }}
            >
              {t("virtualDesignStudio")}
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.55 }}
            className="mx-auto mt-6 max-w-md text-base text-marble/60 sm:text-lg"
          >
            {t("vdsTagline")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-12"
          >
            <Link
              href="/gallery/kitchen"
              className="atelier-enter-btn btn-shine group inline-flex items-center gap-3 rounded-sm bg-[#2d8a4e] px-10 py-4 font-mono-data text-xs uppercase tracking-[0.14em] text-white shadow-[0_8px_32px_rgba(45,138,78,0.35)] transition-all hover:bg-[#247a44] hover:shadow-[0_12px_40px_rgba(45,138,78,0.45)]"
            >
              {t("enterStudio")}
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <main className="relative z-10 flex flex-col items-center border-t border-white/8 px-6 pb-28 pt-16 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.85, ease }}
          className="w-full max-w-5xl"
        >
          <div className="compare-frame relative p-px">
            <div className="compare-frame__glow" aria-hidden />
            <BeforeAfterSlider
              beforeSrc="/scenes/kitchen-modern/base.jpg"
              afterSrc="/scenes/kitchen-1/base.jpg"
              beforeLabel={t("beforeLabel")}
              afterLabel={t("afterLabel")}
              hint={t("dragToCompare")}
              autoPlay
              className="relative aspect-[16/10] w-full shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
            />
          </div>
          <p className="mt-4 text-center font-mono-data text-[10px] uppercase tracking-[0.25em] text-marble/35">
            {t("atelierCompareHint")}
          </p>
        </motion.div>

        <div className="mt-16 w-full max-w-5xl">
          <FinishMarquee />
        </div>

        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12 } },
          }}
          className="mt-14 grid w-full max-w-4xl gap-4 sm:grid-cols-3"
        >
          {(
            [
              { k: "atelierStep1Title", d: "atelierStep1Desc" },
              { k: "atelierStep2Title", d: "atelierStep2Desc" },
              { k: "atelierStep3Title", d: "atelierStep3Desc" },
            ] as const satisfies ReadonlyArray<{ k: TranslationKey; d: TranslationKey }>
          ).map((step, i) => (
            <motion.li
              key={step.k}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
              }}
              className="step-card border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm transition-colors hover:border-brass/40 hover:bg-white/[0.06]"
            >
              <p className="font-mono-data text-[10px] text-brass">0{i + 1}</p>
              <p className="font-display mt-3 text-xl text-marble">{t(step.k)}</p>
              <p className="mt-2 text-sm leading-relaxed text-marble/45">{t(step.d)}</p>
            </motion.li>
          ))}
        </motion.ul>
      </main>

      <footer className="relative z-10 border-t border-white/8 px-6 py-5 text-center sm:px-10">
        <p className="font-mono-data text-[10px] text-marble/30">
          © {new Date().getFullYear()} {SHOP.name} · {t("madeInPakistan")}
        </p>
      </footer>

      <StickyAtelierCTA />
    </div>
  );
}
