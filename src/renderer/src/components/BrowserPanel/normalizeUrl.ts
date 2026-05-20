export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "about:blank";
  if (trimmed === "about:blank") return trimmed;
  const isLocal =
    trimmed === "localhost" ||
    trimmed.startsWith("localhost:") ||
    trimmed.startsWith("localhost/") ||
    /^127\.0\.0\.1(:\d+)?(\/|$)/.test(trimmed) ||
    /^192\.168\.\d+\.\d+(:\d+)?(\/|$)/.test(trimmed) ||
    /^0\.0\.0\.0(:\d+)?(\/|$)/.test(trimmed);
  if (isLocal) return `http://${trimmed}`;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
