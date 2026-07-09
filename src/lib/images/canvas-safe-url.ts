/**
 * Remote texture hosts (R2 / ZRK) often omit CORS headers.
 * Canvas needs CORS-clean pixels for getImageData / createPattern —
 * route those URLs through our same-origin proxy.
 */

const PROXY_HOST_SUFFIXES = [".r2.dev"] as const;
const PROXY_HOSTS = new Set(["strapi.zrkgroup.com"]);

export function needsCanvasTextureProxy(url: string): boolean {
  try {
    const parsed = new URL(url, "https://asfins.com");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // Same-origin / relative paths are already canvas-safe.
    if (url.startsWith("/") && !url.startsWith("//")) return false;
    const host = parsed.hostname.toLowerCase();
    if (PROXY_HOSTS.has(host)) return true;
    return PROXY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

/** Rewrite remote texture URLs to `/api/texture?url=…` for canvas use. */
export function canvasSafeTextureUrl(url: string): string {
  if (!url || !needsCanvasTextureProxy(url)) return url;
  return `/api/texture?url=${encodeURIComponent(url)}`;
}

export function isAllowedTextureProxyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (PROXY_HOSTS.has(host)) return true;
  return PROXY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
