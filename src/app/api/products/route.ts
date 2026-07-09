import { NextResponse } from "next/server";
import { listProducts } from "@/lib/products/registry";

export async function GET() {
  const products = await listProducts(true);
  return NextResponse.json({ products });
}
