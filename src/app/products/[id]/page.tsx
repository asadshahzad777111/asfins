import { notFound } from "next/navigation";
import { getProductById, listProducts } from "@/lib/products/registry";
import { ProductDetailClient } from "@/components/ProductDetailClient";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const products = await listProducts(true);
  return products.map((p) => ({ id: p.id }));
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product || !product.active) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
