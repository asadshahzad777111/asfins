"use client";

import Link from "next/link";
import { SceneThumbnail } from "@/components/SceneThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { SceneRecord } from "@/lib/scenes/types";

interface SceneSidebarProps {
  scenes: SceneRecord[];
  activeId: string;
  categoryLabel: string;
  linkPrefix?: string;
}

export function SceneSidebar({
  scenes,
  activeId,
  categoryLabel,
  linkPrefix = "/configurator",
}: SceneSidebarProps) {
  const { t } = useLanguage();

  return (
    <aside className="studio-sidebar flex w-[220px] shrink-0 flex-col border-r border-divider bg-[#F5F0E8]">
      <div className="border-b border-divider px-4 py-3">
        <p className="studio-panel-label">{t("selectRoom")}</p>
        <p className="font-display mt-0.5 text-sm text-charcoal">{categoryLabel}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-2">
          {scenes.map((scene, index) => {
            const active = scene.id === activeId;
            return (
              <li key={scene.id}>
                <Link
                  href={`${linkPrefix}/${scene.id}`}
                  prefetch
                  className={`studio-scene-item group relative flex items-center gap-2.5 rounded-sm p-2 transition-all ${
                    active
                      ? "bg-white shadow-sm ring-2 ring-brass"
                      : "hover:bg-white/60"
                  }`}
                >
                  <span
                    className={`absolute -left-0.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full font-mono-data text-[9px] ${
                      active
                        ? "bg-brass text-marble"
                        : "bg-charcoal/10 text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <SceneThumbnail
                    src={scene.thumbnail}
                    alt={scene.name}
                    className="ml-4 h-14 w-16 shrink-0 rounded-sm object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-medium ${
                        active ? "text-charcoal" : "text-muted group-hover:text-charcoal"
                      }`}
                    >
                      {scene.name}
                    </p>
                    <p className="truncate font-mono-data text-[9px] text-muted/70">
                      {scene.zones.length} {t("zonesCount")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
