import { Suspense } from "react";
import { listProducts } from "@/lib/products/registry";
import { ShopPageClient } from "@/components/ShopPageClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listProducts(true);
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1440px] px-5 py-20 text-muted md:px-16">
          Loading shop…
        </div>
      }
    >
      <ShopPageClient products={products} />
    </Suspense>
  );
}
