const UNTITLED_CANVAS_RE = /^untitled canvas$/i;

export function isUnnamedCanvasName(name: string | null | undefined): boolean {
  return !name || name.trim().length === 0 || UNTITLED_CANVAS_RE.test(name.trim());
}

export function promptToCanvasName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const truncated = words.slice(0, 5).join(" ");
  const name = words.length > 5 ? `${truncated}...` : truncated;
  return name.length > 50 ? `${name.slice(0, 47)}...` : name;
}

export function cleanCanvasName(name: string): string {
  const trimmed = name.replace(/^["']|["']$/g, "").replace(/\s+/g, " ").trim();
  return trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed;
}
