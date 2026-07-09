import { getBrandLogo } from "@/lib/brands";

interface BrandLogoProps {
  brandName?: string;
  className?: string;
}

export function BrandLogo({ brandName, className = "h-8 w-auto" }: BrandLogoProps) {
  const brand = getBrandLogo(brandName);
  if (!brand) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.src} alt={brand.alt} className={className} />
  );
}
