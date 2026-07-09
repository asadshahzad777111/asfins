import { redirect } from "next/navigation";
import { listPublicScenes } from "@/lib/scenes/registry";

interface Props {
  searchParams: Promise<{ scene?: string }>;
}

export default async function ConfiguratorPage({ searchParams }: Props) {
  const { scene: sceneQuery } = await searchParams;
  if (sceneQuery) {
    redirect(`/configurator/${sceneQuery}`);
  }

  const scenes = await listPublicScenes();
  const first = scenes.find((s) => s.category === "kitchen") ?? scenes[0];
  if (first) {
    redirect(`/configurator/${first.id}`);
  }

  redirect("/gallery");
}
