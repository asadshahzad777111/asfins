"use client";

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
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${className} ${radius} border-2 border-divider object-cover shadow-md`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={`${className} ${radius} block border-2 border-divider shadow-md`}
      style={{ backgroundColor: hex || "#888888" }}
      title={name}
      aria-hidden
    />
  );
}
