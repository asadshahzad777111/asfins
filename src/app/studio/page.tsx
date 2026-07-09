import { listPublicScenes } from "@/lib/scenes/registry";
import { StudioLandingClient } from "@/components/studio/StudioLandingClient";

export default async function StudioPage() {
  await listPublicScenes();
  return <StudioLandingClient />;
}
