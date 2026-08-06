import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  listProducts,
  saveProduct,
  deleteProduct,
  slugifyProductId,
} from "@/lib/products/registry";
import type { Product } from "@/lib/products/types";

function optionalString(form: FormData, key: string): string | undefined {
  const val = String(form.get(key) ?? "").trim();
  return val || undefined;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const products = await listProducts();
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const pricePKR = Number(form.get("pricePKR") ?? 0);
  const category = String(form.get("category") ?? "general").trim();
  const description = String(form.get("description") ?? "").trim();
  const active = form.get("active") !== "false";
  const imageFile = form.get("image");
  const imageUrl = optionalString(form, "imageUrl");

  if (!name || pricePKR <= 0) {
    return NextResponse.json({ error: "Name and price required" }, { status: 400 });
  }

  const productId = slugifyProductId(name);
  let imagePath = imageUrl ?? "/products/placeholder.svg";

  if (imageFile instanceof File && imageFile.size > 0) {
    const dir = path.join(process.cwd(), "public", "products");
    await mkdir(dir, { recursive: true });
    const ext = imageFile.name.toLowerCase().endsWith(".png") ? ".png" : ".jpg";
    const filename = `${productId}${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(await imageFile.arrayBuffer()));
    imagePath = `/products/${filename}`;
  }

  const product: Product = {
    id: productId,
    name,
    pricePKR,
    image: imagePath,
    category,
    description,
    active,
    createdAt: new Date().toISOString(),
    productCode: optionalString(form, "productCode"),
    surfaceFinish: optionalString(form, "surfaceFinish"),
    colorDescription: optionalString(form, "colorDescription"),
    dimensions: optionalString(form, "dimensions"),
    thickness: optionalString(form, "thickness"),
    idealApplications: optionalString(form, "idealApplications"),
    brandName: optionalString(form, "brandName"),
    technicalSheetUrl: optionalString(form, "technicalSheetUrl"),
    materialCategory: optionalString(form, "materialCategory"),
    substrate: (() => {
      const s = optionalString(form, "substrate");
      return s === "mdf" || s === "chipboard" ? s : null;
    })(),
    stock: (() => {
      const raw = form.get("stock");
      if (raw == null || String(raw).trim() === "") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    })(),
    lowStockAt: (() => {
      const raw = form.get("lowStockAt");
      if (raw == null || String(raw).trim() === "") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    })(),
  };

  await saveProduct(product);
  return NextResponse.json({ ok: true, product }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

  const ok = await deleteProduct(id);
  if (!ok) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
