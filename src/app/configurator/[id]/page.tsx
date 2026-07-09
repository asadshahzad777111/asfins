import { notFound } from "next/navigation";
import { StudioConfigurator } from "@/components/studio/StudioConfigurator";
import { StudioHeader } from "@/components/studio/StudioHeader";
import {
  getSceneConfigById,
  getSceneById,
  listScenesByCategory,
} from "@/lib/scenes/registry";
import { listCatalogs } from "@/lib/catalogs/registry";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConfiguratorScenePage({ params }: Props) {
  const { id } = await params;
  const [scene, record, allCatalogs] = await Promise.all([
    getSceneConfigById(id),
    getSceneById(id),
    listCatalogs(),
  ]);

  if (!scene || !record) notFound();

  const categoryScenes = await listScenesByCategory(record.category);

  const sceneCatalogs = allCatalogs.filter(
    (c) => c.global || !record.catalogIds?.length || record.catalogIds.includes(c.id)
  );

  return (
    <>
      <StudioHeader />
      <StudioConfigurator
        scene={scene}
        sceneRecord={record}
        categoryScenes={categoryScenes}
        catalogs={sceneCatalogs}
      />
    </>
  );
}
