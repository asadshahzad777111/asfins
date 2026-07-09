import { notFound } from "next/navigation";
import { listCatalogs } from "@/lib/catalogs/registry";
import { findCatalogMaterial } from "@/lib/catalogs/materials";
import { MaterialDetailClient } from "@/components/MaterialDetailClient";

interface PageProps {
  params: Promise<{ catalogId: string; swatchId: string }>;
}

export default async function MaterialDetailPage({ params }: PageProps) {
  const { catalogId, swatchId } = await params;
  const catalogs = await listCatalogs();
  const material = findCatalogMaterial(catalogs, catalogId, swatchId);
  if (!material) notFound();
  return <MaterialDetailClient material={material} />;
}
