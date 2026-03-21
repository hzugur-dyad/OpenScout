/**
 * Strips markdown fences and extracts the outermost JSON object substring from model text.
 */
export function extractJsonObjectFromModelText(raw: string): string {
  let s = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const m = s.match(codeBlock);
  if (m) s = m[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

/** Outermost `{...}` that ends at the last `}` in the string (for trailing structured payloads). */
export function extractTrailingJsonObject(raw: string): string | null {
  const s = raw.trim();
  const end = s.lastIndexOf("}");
  if (end === -1) return null;
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    const c = s[i];
    if (c === "}") depth++;
    else if (c === "{") {
      depth--;
      if (depth === 0) return s.slice(i, end + 1);
    }
  }
  return null;
}

export function stripTrailingJsonSlice(raw: string, jsonSlice: string): string {
  const idx = raw.lastIndexOf(jsonSlice);
  if (idx < 0) return raw.trim();
  return raw.slice(0, idx).trim();
}
