"use client";

import Link from "next/link";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { SceneThumbnail } from "@/components/SceneThumbnail";
import type { SceneRecord } from "@/lib/scenes/types";

interface HomePageClientProps {
  kitchens: SceneRecord[];
}

export function HomePageClient({ kitchens }: HomePageClientProps) {
  const { lang, t } = useLanguage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
        {t("colorVisualizer")}
      </p>
      <h1 className="font-display mt-4 text-4xl leading-tight tracking-tight text-charcoal sm:text-5xl">
        {t("homeTitle")}
        <br />
        <span className="text-brass">{t("homeTitleAccent")}</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        {t("homeSubtitle")}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/gallery"
          className="rounded-sm border border-divider bg-marble px-6 py-3 text-sm text-charcoal hover:border-brass"
        >
          {t("allRoomTypes")}
        </Link>
        <Link
          href="/contact"
          className="rounded-sm px-4 py-3 font-mono-data text-xs text-muted hover:text-brass"
        >
          {t("contact")}
        </Link>
      </div>

      {kitchens.length === 0 ? (
        <p className="mt-12 rounded-sm border border-divider bg-marble p-8 text-center text-muted">
          {t("emptyGallery")}
        </p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {kitchens.map((s) => (
            <Link
              key={s.id}
              href={`/configurator/${s.id}`}
              className="card-hover group overflow-hidden rounded-sm border border-divider bg-marble"
            >
              <SceneThumbnail
                src={s.thumbnail}
                alt={s.name}
                className="h-48 w-full object-cover transition-transform group-hover:scale-[1.02]"
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
          ))}
        </div>
      )}

      <p className="mt-12 font-mono-data text-xs text-muted">
        {SHOP.name} · {SHOP.city} · {t("shopTagline")}
      </p>
    </div>
  );
}
