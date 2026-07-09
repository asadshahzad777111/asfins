import { NextResponse } from "next/server";
import { listCatalogs } from "@/lib/catalogs/registry";

export async function GET() {
  const catalogs = await listCatalogs();
  return NextResponse.json({ catalogs });
}
