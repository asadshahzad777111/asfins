import { notFound } from "next/navigation";
import { StudioConfigurator } from "@/components/studio/StudioConfigurator";
import { StudioHeader } from "@/components/studio/StudioHeader";
import {
  getSceneById,
  getSceneConfigById,
  listScenesByCategory,
} from "@/lib/scenes/registry";
import { listCatalogs } from "@/lib/catalogs/registry";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudioKitchenScenePage({ params }: Props) {
  const { id } = await params;
  const [scene, record, allCatalogs, kitchenScenes] = await Promise.all([
    getSceneConfigById(id),
    getSceneById(id),
    listCatalogs(),
    listScenesByCategory("kitchen"),
  ]);

  if (!scene || !record || record.category !== "kitchen") notFound();

  const sceneCatalogs = allCatalogs.filter(
    (c) => c.global || !record.catalogIds?.length || record.catalogIds.includes(c.id)
  );

  return (
    <>
      <StudioHeader />
      <StudioConfigurator
        scene={scene}
        sceneRecord={record}
        categoryScenes={kitchenScenes}
        catalogs={sceneCatalogs}
        sceneLinkPrefix="/studio/kitchen"
      />
    </>
  );
}
