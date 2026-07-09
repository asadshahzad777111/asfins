"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roomLabel } from "@/lib/i18n/translations";
import type { RoomCategoryMeta } from "@/lib/rooms";

interface GalleryPageClientProps {
  categories: (RoomCategoryMeta & { count: number })[];
}

export function GalleryPageClient({ categories }: GalleryPageClientProps) {
  const { lang, t } = useLanguage();

  return (
    <div className="atelier-grain studio-gallery min-h-screen bg-base">
      <div className="relative z-[2] mx-auto max-w-6xl px-4 py-14 pb-28 sm:px-6 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
        >
          <Link
            href="/studio"
            className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-brass hover:underline"
          >
            ← {t("backToStudio")}
          </Link>

          <p className="font-mono-data mt-8 text-[10px] uppercase tracking-[0.35em] text-muted">
            {t("roomGallery")}
          </p>
          <h1 className="font-display mt-4 text-4xl leading-[1.05] tracking-tight text-charcoal sm:text-5xl">
            {t("galleryTitle")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{t("gallerySubtitle")}</p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`/gallery/${cat.id}`} className="gallery-card group block">
                <div className="gallery-card__media">
                  <div
                    className="gallery-card__media-glow absolute inset-0"
                    style={{ background: cat.gradient }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.coverImage}
                    alt={roomLabel(lang, cat.id)}
                    className="gallery-card__photo absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    loading={i < 3 ? "eager" : "lazy"}
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 left-0 right-0 z-[1] p-5">
                    <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-marble/80">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h2 className="font-display mt-1 text-2xl text-marble drop-shadow-sm">
                      {roomLabel(lang, cat.id)}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-marble px-5 py-4">
                  <p className="font-mono-data text-xs text-muted">
                    {cat.count === 1
                      ? t("photoCount", { count: cat.count })
                      : t("photoCountPlural", { count: cat.count })}
                  </p>
                  <span className="font-mono-data text-xs text-brass transition-transform group-hover:translate-x-1">
                    {t("exploreCategory")}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
