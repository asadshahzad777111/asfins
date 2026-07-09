import { AdminShell } from "@/components/admin/AdminShell";
import { ProductsAdmin } from "@/components/admin/ProductsAdmin";
import { listProducts } from "@/lib/products/registry";

export default async function AdminProductsPage() {
  const products = await listProducts();

  return (
    <AdminShell>
      <ProductsAdmin initialProducts={products} />
    </AdminShell>
  );
}
