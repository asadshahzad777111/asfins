"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Catalog } from "@/lib/catalogs/types";

export interface BrandFolderItem {
  id: string;
  name: string;
  count: number;
  previewUrl?: string;
  previewHex?: string;
}

interface BrandCatalogFoldersProps {
  folders: BrandFolderItem[];
  onOpen: (id: string) => void;
  columns?: "products" | "studio";
}

/** Unique brand/catalog folders — click to open that catalog. */
export function BrandCatalogFolders({
  folders,
  onOpen,
  columns = "products",
}: BrandCatalogFoldersProps) {
  const { t } = useLanguage();
  const grid =
    columns === "studio"
      ? "grid grid-cols-2 gap-2.5"
      : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4";

  return (
    <div className={grid}>
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onOpen(folder.id)}
          className="group relative flex flex-col overflow-hidden rounded-sm border border-divider bg-marble text-left transition hover:border-brass/50 hover:shadow-[0_8px_24px_rgba(40,32,24,0.08)]"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-base">
            {folder.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={folder.previewUrl}
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ backgroundColor: folder.previewHex ?? "#C4A574" }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/55 via-charcoal/10 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2">
              <BrandLogo brandName={folder.name} className="h-6 w-auto max-w-[40%] object-contain drop-shadow" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
            <span className="font-display text-sm leading-tight text-charcoal sm:text-base">
              {folder.name}
            </span>
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted">
              {t("folderSheetCount", { count: folder.count })}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function catalogsToFolders(
  catalogs: Catalog[],
  { requireGlobal = false }: { requireGlobal?: boolean } = {}
): BrandFolderItem[] {
  return catalogs
    .filter((c) => c.swatches.length > 0 && (!requireGlobal || c.global))
    .map((c) => {
      const preview = c.swatches.find((s) => s.thumbUrl || s.imageUrl) ?? c.swatches[0];
      return {
        id: c.id,
        name: c.companyName,
        count: c.swatches.length,
        previewUrl: preview?.thumbUrl ?? preview?.imageUrl,
        previewHex: preview?.hex,
      };
    });
}
