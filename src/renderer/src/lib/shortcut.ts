/**
 * Tiny shortcut parser/matcher. Shortcuts are stored as e.g. "Mod+s" or
 * "Mod+Shift+k". "Mod" means ⌘ on macOS and Ctrl elsewhere.
 *
 * Single-key shortcuts without a modifier are intentionally disallowed when
 * recording (would conflict with typing); only modifier-combos are accepted.
 */

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** Parse a shortcut string into a normalized shape for matching. */
type ParsedShortcut = {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
};

function parse(shortcut: string): ParsedShortcut | null {
  if (!shortcut) return null;
  const parts = shortcut.split("+").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts.pop()!.toLowerCase();
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  return {
    mod: mods.has("mod") || mods.has("cmd") || mods.has("ctrl"),
    shift: mods.has("shift"),
    alt: mods.has("alt") || mods.has("option"),
    key,
  };
}

/** Does this KeyboardEvent match the given shortcut string? */
export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const p = parse(shortcut);
  if (!p) return false;
  const modPressed = IS_MAC ? e.metaKey : e.ctrlKey;
  if (p.mod !== modPressed) return false;
  if (p.shift !== e.shiftKey) return false;
  if (p.alt !== e.altKey) return false;
  return e.key.toLowerCase() === p.key;
}

/** Render a shortcut string for display (e.g. "⌘S" on mac, "Ctrl+S" elsewhere). */
export function formatShortcut(shortcut: string): string {
  const p = parse(shortcut);
  if (!p) return shortcut;
  const out: string[] = [];
  if (p.mod) out.push(IS_MAC ? "⌘" : "Ctrl");
  if (p.shift) out.push(IS_MAC ? "⇧" : "Shift");
  if (p.alt) out.push(IS_MAC ? "⌥" : "Alt");
  out.push(p.key.length === 1 ? p.key.toUpperCase() : p.key);
  return IS_MAC ? out.join("") : out.join("+");
}

/** Build a shortcut string from a KeyboardEvent (for recording). Returns null
 *  if the event is just a bare key or only a modifier with no payload key. */
export function shortcutFromEvent(e: KeyboardEvent): string | null {
  const key = e.key;
  if (!key) return null;
  // Ignore pure modifier presses.
  if (
    key === "Meta" ||
    key === "Control" ||
    key === "Shift" ||
    key === "Alt" ||
    key === "OS"
  )
    return null;
  const mods: string[] = [];
  if (IS_MAC ? e.metaKey : e.ctrlKey) mods.push("Mod");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  // Require at least one modifier to avoid binding to plain typing keys.
  if (mods.length === 0) return null;
  return [...mods, key.toLowerCase()].join("+");
}
