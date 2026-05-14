export function prettyPath(p: string): string {
  if (!p) return "";
  const normalized = p.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return p;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return normalized.startsWith("/") ? `/${parts.join("/")}` : parts.join("/");
  }
  return `…/${parts.slice(-2).join("/")}`;
}
