import { NextRequest, NextResponse } from "next/server";
import { isAllowedTextureProxyHost } from "@/lib/images/canvas-safe-url";

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Same-origin proxy for catalog textures used by the canvas engine.
 * R2 pub-*.r2.dev often ships without Access-Control-Allow-Origin, which
 * taints the canvas when crossOrigin="anonymous" images are drawn.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  if (!isAllowedTextureProxyHost(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "ASFinsTextureProxy/1.0",
        Accept: "image/*,*/*",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Invalid image size" }, { status: 400 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Proxy fetch failed" },
      { status: 502 }
    );
  }
}
