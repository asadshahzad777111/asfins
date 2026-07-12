"use client";

import Link from "next/link";
import { SwatchThumb } from "@/components/SwatchThumb";

export interface ZrkCatalogCardProps {
  imageSrc?: string;
  thumbSrc?: string;
  hex?: string;
  code: string;
  title: string;
  subtitle?: string;
  meta?: string;
  /** Brand / company (e.g. Patex, ZRK) — shown on the card face */
  brand?: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function ZrkCatalogCard({
  imageSrc,
  thumbSrc,
  hex,
  code,
  title,
  subtitle,
  meta,
  brand,
  active,
  href,
  onClick,
  className = "",
}: ZrkCatalogCardProps) {
  const inner = (
    <>
      <div className="zrk-catalog-card__visual relative aspect-square overflow-hidden bg-white">
        {imageSrc || hex ? (
          <SwatchThumb
            hex={hex ?? "#888"}
            imageUrl={imageSrc}
            thumbUrl={thumbSrc}
            name={title}
            className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            rounded="none"
          />
        ) : (
          <div className="h-full w-full bg-charcoal/10" />
        )}
        {brand && (
          <span className="absolute left-2 top-2 z-[1] bg-ink/85 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-paper">
            {brand}
          </span>
        )}
        <div className="zrk-catalog-card__overlay" aria-hidden>
          <div className="zrk-catalog-card__overlay-inner">
            <p className="zrk-catalog-card__title">{title}</p>
            {subtitle && <p className="zrk-catalog-card__subtitle">{subtitle}</p>}
            {meta && <p className="zrk-catalog-card__meta">{meta}</p>}
          </div>
        </div>
      </div>
      <div
        className={`zrk-catalog-card__code ${active ? "is-active" : ""}`}
      >
        {brand ? (
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate">{code}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-muted">
              {brand}
            </span>
          </span>
        ) : (
          code
        )}
      </div>
    </>
  );

  const baseClass = `zrk-catalog-card group block ${active ? "is-active" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${baseClass} text-left`}>
      {inner}
    </button>
  );
}
