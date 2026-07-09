import { NextResponse } from "next/server";
import { listPublicScenes } from "@/lib/scenes/registry";

export async function GET() {
  const scenes = await listPublicScenes();
  return NextResponse.json({ scenes });
}
