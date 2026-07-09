import { redirect } from "next/navigation";
import { listScenesByCategory } from "@/lib/scenes/registry";

export default async function StudioKitchenIndexPage() {
  const scenes = await listScenesByCategory("kitchen");
  const preferred = scenes.find((s) => s.id === "new2") ?? scenes[0];
  if (!preferred) redirect("/studio");
  redirect(`/studio/kitchen/${preferred.id}`);
}
