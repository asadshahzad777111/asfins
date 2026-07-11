/**
 * Turn a failed fetch Response into a human-readable message.
 * Avoids labelling HTML/413/empty bodies as a generic "network error".
 */
export async function readApiErrorMessage(
  res: Response,
  fallback: string
): Promise<string> {
  const status = res.status;
  const statusBit = status ? ` (HTTP ${status})` : "";
  let text = "";
  try {
    text = await res.text();
  } catch {
    return `${fallback}${statusBit}`;
  }

  if (!text) {
    if (status === 413) {
      return `Upload too large${statusBit}. Try smaller PNGs or fewer zones at once.`;
    }
    return `${fallback}${statusBit}`;
  }

  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    const msg = data.error ?? data.message;
    if (msg) return msg;
  } catch {
    // not JSON — fall through
  }

  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 180);
  if (status === 413 || /request entity too large|payload too large|413/i.test(text)) {
    return `Upload too large${statusBit}. Images were reduced automatically — if this persists, use smaller cutouts.`;
  }
  if (snippet.startsWith("<") || /<!DOCTYPE|<\/html>/i.test(snippet)) {
    return `Server error${statusBit}. ${fallback}`;
  }
  return snippet || `${fallback}${statusBit}`;
}

export function formatFetchFailure(err: unknown, networkFallback: string): string {
  if (err instanceof TypeError) {
    // Browser "Failed to fetch" / aborted — real connectivity or CORS / blocked body.
    return `${networkFallback}${err.message ? ` (${err.message})` : ""}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return networkFallback;
}
