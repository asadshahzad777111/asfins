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
        {code}
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
