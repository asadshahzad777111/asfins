import { NextResponse } from "next/server";
import { getSceneConfigById } from "@/lib/scenes/registry";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = await getSceneConfigById(id);

  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  return NextResponse.json({ scene });
}
