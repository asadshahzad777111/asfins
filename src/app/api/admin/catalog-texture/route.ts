import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import sharp from "sharp";

/**
 * Upload a catalog swatch texture → public/catalog-textures/{folder}/
 * Returns local same-origin URLs for image + thumb.
 */
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

  const file = form.get("file");
  const folder = String(form.get("folder") ?? "custom")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "") || "custom";
  const code = String(form.get("code") ?? `sw-${Date.now()}`)
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "") || `sw-${Date.now()}`;

  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "catalog-textures", folder);
  const thumbDir = path.join(dir, "thumbs");
  await mkdir(thumbDir, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  const fullName = `${code}.webp`;
  const fullPath = path.join(dir, fullName);
  const thumbPath = path.join(thumbDir, fullName);

  await sharp(buf)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(fullPath);

  await sharp(buf)
    .resize(320, 320, { fit: "cover" })
    .webp({ quality: 75 })
    .toFile(thumbPath);

  const imageUrl = `/catalog-textures/${folder}/${fullName}`;
  const thumbUrl = `/catalog-textures/${folder}/thumbs/${fullName}`;

  return NextResponse.json({ ok: true, imageUrl, thumbUrl });
}
