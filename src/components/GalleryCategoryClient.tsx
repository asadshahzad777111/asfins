"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SceneThumbnail } from "@/components/SceneThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roomLabel } from "@/lib/i18n/translations";
import type { SceneRecord } from "@/lib/scenes/types";
import type { RoomCategoryMeta } from "@/lib/rooms";

interface GalleryCategoryClientProps {
  meta: RoomCategoryMeta;
  scenes: SceneRecord[];
}

export function GalleryCategoryClient({ meta, scenes }: GalleryCategoryClientProps) {
  const { lang, t } = useLanguage();

  return (
    <div className="atelier-grain studio-gallery min-h-screen bg-base">
      <div className="relative z-[2] mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href="/gallery"
            className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-brass hover:underline"
          >
            {t("allRooms")}
          </Link>
          <div
            className="relative mt-6 h-36 w-full overflow-hidden border border-divider sm:h-44"
            style={{ background: meta.gradient }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta.coverImage}
              alt=""
              className="h-full w-full object-cover opacity-90"
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-base via-transparent to-transparent" />
          </div>
          <div
            className="mt-0 h-1.5 w-16"
            style={{ background: meta.accent }}
            aria-hidden
          />
          <h1 className="font-display mt-4 text-4xl tracking-tight text-charcoal">
            {roomLabel(lang, meta.id)}
          </h1>
          <p className="mt-2 text-muted">{t("choosePhoto")}</p>
        </motion.div>

        {scenes.length === 0 ? (
          <p className="mt-10 rounded-sm border border-divider bg-white p-8 text-center text-muted">
            {t("emptyCategory")}
          </p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <Link
                  href={
                    meta.id === "kitchen"
                      ? `/studio/kitchen/${s.id}`
                      : `/configurator/${s.id}`
                  }
                  prefetch
                  className="gallery-card group block overflow-hidden"
                >
                  <SceneThumbnail
                    src={s.thumbnail}
                    alt={s.name}
                    className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="p-4">
                    <h2 className="font-display text-lg text-charcoal group-hover:text-brass">
                      {s.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p>
                    <p className="font-mono-data mt-2 text-xs text-brass">
                      {t("pickWoodColour")}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
