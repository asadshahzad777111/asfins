"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface SceneCardProps {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  zoneCount: number;
}

export function SceneCard({ id, name, description, thumbnail, zoneCount }: SceneCardProps) {
  const { t } = useLanguage();

  return (
    <Link
      href={`/configurator/${id}`}
      className="card-hover group overflow-hidden rounded-sm border border-divider bg-marble"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnail}
        alt={name}
        className="h-48 w-full object-cover transition-transform group-hover:scale-[1.02]"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/scenes/kitchen-1/base.jpg";
        }}
      />
      <div className="p-4">
        <h2 className="font-display text-lg text-charcoal group-hover:text-brass">{name}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{description}</p>
        <p className="font-mono-data mt-2 text-xs text-brass">
          {t("zonesCustomize", { count: zoneCount })}
        </p>
      </div>
    </Link>
  );
}
