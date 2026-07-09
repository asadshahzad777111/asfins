import { NextResponse } from "next/server";
import { listPublicScenes } from "@/lib/scenes/registry";

export async function GET() {
  const scenes = await listPublicScenes();
  return NextResponse.json({
    scenes: scenes.map(({ id, name, thumbnail, description, category, zones }) => ({
      id,
      name,
      thumbnail,
      description,
      category,
      zoneCount: zones.length,
    })),
  });
}
