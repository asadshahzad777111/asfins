import { listProducts } from "@/lib/products/registry";
import { HomePageClient } from "@/components/HomePageClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await listProducts(true);
  const accessories = products.filter((p) =>
    ["handles", "hardware", "organizers", "sinks", "accessories"].includes(
      p.category.toLowerCase()
    )
  );
  const sheets = products.filter((p) =>
    ["wood-laminate", "marble"].includes(p.category.toLowerCase())
  );
  const featured = [
    ...accessories.slice(0, 3),
    ...sheets.filter((p) => p.pricePKR > 0).slice(0, 6 - Math.min(3, accessories.length)),
  ].slice(0, 6);

  return <HomePageClient featured={featured} />;
}
