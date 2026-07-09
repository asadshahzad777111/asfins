"use client";

import Image from "next/image";

interface SwatchThumbProps {
  hex: string;
  imageUrl?: string;
  /** Prefer thumb for catalog grid — much faster than remote Strapi URLs */
  thumbUrl?: string;
  name: string;
  className?: string;
  rounded?: "full" | "sm" | "none";
  /** Detail / hero views use full imageUrl */
  preferFull?: boolean;
  priority?: boolean;
}

export function SwatchThumb({
  hex,
  imageUrl,
  thumbUrl,
  name,
  className = "h-14 w-14",
  rounded = "full",
  preferFull = false,
  priority = false,
}: SwatchThumbProps) {
  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "none"
        ? "rounded-none"
        : "rounded-sm";

  const src = preferFull ? (imageUrl ?? thumbUrl) : (thumbUrl ?? imageUrl);

  if (src) {
    const isLocal = src.startsWith("/");

    return (
      <span className={`relative block ${className} ${radius} overflow-hidden border-2 border-divider shadow-md`}>
        <Image
          src={src}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
          priority={priority}
          unoptimized={!isLocal}
        />
      </span>
    );
  }

  return (
    <span
      className={`${className} ${radius} border-2 border-divider shadow-md`}
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}
