const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

export function safeExternalHref(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!SAFE_EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
