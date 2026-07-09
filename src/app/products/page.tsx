import { listProducts } from "@/lib/products/registry";
import { listCatalogs } from "@/lib/catalogs/registry";
import { flattenCatalogMaterials } from "@/lib/catalogs/materials";
import { ProductsPageClient } from "@/components/ProductsPageClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [products, catalogs] = await Promise.all([listProducts(true), listCatalogs()]);
  const materials = flattenCatalogMaterials(catalogs);
  return <ProductsPageClient products={products} materials={materials} />;
}
