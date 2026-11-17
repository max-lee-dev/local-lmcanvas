/** Default Claude model when the user hasn't picked one. */
export const CLAUDE_DEFAULT_MODEL = "claude-fable-5-2";

/** Model a Fable run is retried on when it ends in a policy refusal. */
export const CLAUDE_POLICY_FALLBACK_MODEL = "claude-opus-5-5";

/**
 * Earlier app defaults that got persisted into settings.json because
 * writeSettings stores the merged defaults. Treat them as "unset" so existing
 * installs follow CLAUDE_DEFAULT_MODEL instead of staying pinned forever.
 */
export const LEGACY_CLAUDE_DEFAULT_MODELS = ["claude-fable-5"];

const CLAUDE_FAMILIES = ["fable", "mythos", "opus", "sonnet", "haiku"];

/**
 * "claude-fable-5-2" → "Fable 5.2", "claude-opus-4-8" → "Opus 4.8",
 * "claude-haiku-4-5-20251001" → "Haiku 4.5". Unknown ids pass through.
 */
export function prettyClaudeModelLabel(modelId: string): string {
  const parts = modelId.trim().toLowerCase().split("-");
  const idx = parts.findIndex((p) => CLAUDE_FAMILIES.includes(p));
  if (idx === -1) return modelId;
  const family = parts[idx];
  const name = family.charAt(0).toUpperCase() + family.slice(1);
  // Version segments are short numbers; date suffixes (8 digits) are skipped.
  const version = parts
    .slice(idx + 1)
    .filter((p) => /^\d{1,2}$/.test(p))
    .slice(0, 2)
    .join(".");
  return version ? `${name} ${version}` : name;
}
