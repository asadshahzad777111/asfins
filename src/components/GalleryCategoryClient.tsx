"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SceneThumbnail } from "@/components/SceneThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roomLabel } from "@/lib/i18n/translations";
import type { SceneRecord } from "@/lib/scenes/types";
import type { RoomCategoryMeta } from "@/lib/rooms";
import { Reveal } from "@/components/motion/Reveal";

interface GalleryCategoryClientProps {
  meta: RoomCategoryMeta;
  scenes: SceneRecord[];
}

const ease = [0.22, 1, 0.36, 1] as const;

export function GalleryCategoryClient({ meta, scenes }: GalleryCategoryClientProps) {
  const { lang, t } = useLanguage();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="px-[clamp(1.25rem,4vw,2.5rem)] py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
        >
          <Link
            href="/gallery"
            className="nav-underline text-[13px] text-muted hover:text-ink"
          >
            {t("allRooms")}
          </Link>

          <div className="relative mt-8 h-[40vh] min-h-[220px] w-full overflow-hidden bg-ink sm:h-[48vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta.coverImage}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            <div className="absolute bottom-0 left-0 p-6 text-paper sm:p-10">
              <h1 className="text-heading-lg">{roomLabel(lang, meta.id)}</h1>
              <p className="mt-3 max-w-md text-[15px] text-paper/75">{t("choosePhoto")}</p>
            </div>
          </div>
        </motion.div>

        {scenes.length === 0 ? (
          <p className="mt-12 border border-ink/15 p-10 text-center text-muted">
            {t("emptyCategory")}
          </p>
        ) : (
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.05}>
                <Link
                  href={
                    meta.id === "kitchen"
                      ? `/studio/kitchen/${s.id}`
                      : `/configurator/${s.id}`
                  }
                  prefetch
                  className="group block"
                >
                  <div className="image-mask overflow-hidden bg-ink">
                    <SceneThumbnail
                      src={s.thumbnail}
                      alt={s.name}
                      className="h-56 w-full object-cover sm:h-64"
                    />
                  </div>
                  <div className="pt-4">
                    <h2 className="font-display text-xl tracking-tight transition-opacity group-hover:opacity-60">
                      {s.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-[14px] text-muted">
                      {s.description}
                    </p>
                    <p className="mt-3 text-[13px]">{t("pickWoodColour")}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
