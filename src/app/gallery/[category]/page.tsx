import { notFound } from "next/navigation";
import { listScenesByCategory } from "@/lib/scenes/registry";
import { getRoomMeta } from "@/lib/rooms";
import { GalleryCategoryClient } from "@/components/GalleryCategoryClient";
import type { RoomCategory } from "@/lib/scenes/types";

interface Props {
  params: Promise<{ category: string }>;
}

export default async function GalleryCategoryPage({ params }: Props) {
  const { category } = await params;
  const meta = getRoomMeta(category as RoomCategory);
  const scenes = await listScenesByCategory(category as RoomCategory);

  if (!meta) notFound();

  return <GalleryCategoryClient meta={meta} scenes={scenes} />;
}
