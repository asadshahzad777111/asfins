import { listPublicScenes } from "@/lib/scenes/registry";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import { GalleryPageClient } from "@/components/GalleryPageClient";

export default async function GalleryPage() {
  const scenes = await listPublicScenes();

  const counts = ROOM_CATEGORIES.map((cat) => ({
    ...cat,
    count: scenes.filter((s) => s.category === cat.id).length,
  }));

  return <GalleryPageClient categories={counts} />;
}
