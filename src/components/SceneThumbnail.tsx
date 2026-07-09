"use client";

interface Props {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function SceneThumbnail({ src, alt, className, priority }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        if (!img.dataset.fallback) {
          img.dataset.fallback = "1";
          img.src = "/scenes/kitchen-1/base.jpg";
        }
      }}
    />
  );
}
