"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roomLabel } from "@/lib/i18n/translations";
import type { RoomCategoryMeta } from "@/lib/rooms";
import { Reveal } from "@/components/motion/Reveal";

interface GalleryPageClientProps {
  categories: (RoomCategoryMeta & { count: number })[];
}

const ease = [0.22, 1, 0.36, 1] as const;

export function GalleryPageClient({ categories }: GalleryPageClientProps) {
  const { lang, t } = useLanguage();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="px-[clamp(1.25rem,4vw,2.5rem)] pb-28 pt-14 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease }}
          className="max-w-3xl"
        >
          <Link
            href="/studio"
            className="nav-underline text-[13px] text-muted hover:text-ink"
          >
            ← {t("backToStudio")}
          </Link>

          <p className="mt-10 text-[13px] uppercase tracking-[0.14em] text-muted">
            {t("roomGallery")}
          </p>
          <h1 className="text-heading-lg mt-4">{t("galleryTitle")}</h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            {t("gallerySubtitle")}
          </p>
        </motion.div>

        <div className="mt-16 grid gap-0 border-t border-ink sm:grid-cols-2 lg:grid-cols-3">
          {categories.length === 0 ? (
            <p className="col-span-full border-b border-ink p-10 text-center text-muted sm:border-r-0">
              {t("emptyGallery")}
            </p>
          ) : (
            categories.map((cat, i) => (
            <Reveal key={cat.id} delay={i * 0.05} className="border-b border-ink sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0">
              <Link href={`/gallery/${cat.id}`} className="group block">
                <div className="image-mask relative aspect-[4/3] overflow-hidden bg-ink">
                  <div
                    className="absolute inset-0"
                    style={{ background: cat.gradient }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.coverImage}
                    alt={roomLabel(lang, cat.id)}
                    className="absolute inset-0 h-full w-full object-cover opacity-95"
                    loading={i < 3 ? "eager" : "lazy"}
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-paper">
                    <p className="text-[11px] tracking-[0.16em] text-paper/70">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h2 className="font-display mt-1 text-2xl tracking-tight sm:text-3xl">
                      {roomLabel(lang, cat.id)}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center justify-between px-1 py-4">
                  <p className="text-[13px] text-muted">
                    {cat.count === 1
                      ? t("photoCount", { count: cat.count })
                      : t("photoCountPlural", { count: cat.count })}
                  </p>
                  <span className="text-[13px] transition-transform group-hover:translate-x-1">
                    {t("exploreCategory")}
                  </span>
                </div>
              </Link>
            </Reveal>
          ))
          )}
        </div>
      </div>
    </div>
  );
}
