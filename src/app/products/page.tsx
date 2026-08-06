import { listProducts } from "@/lib/products/registry";
import { ShopPageClient } from "@/components/ShopPageClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listProducts(true);
  return <ShopPageClient products={products} />;
}
