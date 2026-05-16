import type { ToolUseBlock } from "@shared/types";

const VERB_TO_GERUND: Record<string, string> = {
  add: "Adding",
  apply: "Applying",
  build: "Building",
  check: "Checking",
  confirm: "Confirming",
  create: "Creating",
  delete: "Deleting",
  dig: "Digging into",
  edit: "Editing",
  examine: "Examining",
  explore: "Exploring",
  find: "Finding",
  finish: "Finishing",
  fix: "Fixing",
  gather: "Gathering",
  generate: "Generating",
  get: "Getting",
  grep: "Searching",
  handle: "Handling",
  identify: "Identifying",
  implement: "Implementing",
  inspect: "Inspecting",
  investigate: "Investigating",
  look: "Looking at",
  make: "Making",
  move: "Moving",
  open: "Opening",
  read: "Reading",
  refactor: "Refactoring",
  remove: "Removing",
  rename: "Renaming",
  run: "Running",
  scan: "Scanning",
  search: "Searching",
  see: "Looking at",
  set: "Setting",
  setup: "Setting up",
  show: "Showing",
  start: "Starting with",
  test: "Testing",
  trace: "Tracing",
  try: "Trying",
  understand: "Understanding",
  update: "Updating",
  verify: "Verifying",
  view: "Viewing",
  walk: "Walking through",
  watch: "Watching",
  work: "Working on",
  write: "Writing",
};

/**
 * Trim model prose into a short action-form label.
 * "I'll dig into the canvas store first," → "Digging into the canvas store"
 * "Let me check the badge component" → "Checking the badge component"
 * Falls back to a capitalized version of the original if nothing matches.
 */
export function toActionLabel(text: string): string {
  let s = text.trim();
  if (!s) return "";

  // Drop trailing ellipsis / colon / comma so the label looks like a complete clause.
  s = s.replace(/[,:;]?\s*\.{2,}\s*$/g, "");
  s = s.replace(/[,:;]\s*$/g, "");
  s = s.replace(/\s*\.\s*$/g, "");

  const prefixMatch = s.match(
    /^(?:Now,?\s+|First,?\s+|Next,?\s+|Then,?\s+|Also,?\s+|Okay,?\s+|Alright,?\s+)*(?:I['’]ll|I will|I'm going to|I am going to|Let me|I need to|I should|I want to)\s+(\w+)\s*(.*)$/i,
  );
  if (prefixMatch) {
    const verb = prefixMatch[1].toLowerCase();
    const rest = prefixMatch[2];
    const gerund = VERB_TO_GERUND[verb];
    if (gerund) return rest ? `${gerund} ${rest}` : gerund;
    // Unknown verb — keep it but capitalize.
    const capVerb = verb.charAt(0).toUpperCase() + verb.slice(1);
    return rest ? `${capVerb} ${rest}` : capVerb;
  }

  // No first-person prefix — just capitalize the first letter.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Action = { verb: string; nounSingular: string; nounPlural: string };

const TOOL_ACTIONS: Record<string, Action> = {
  Read: { verb: "Reading", nounSingular: "file", nounPlural: "files" },
  Edit: { verb: "Editing", nounSingular: "file", nounPlural: "files" },
  MultiEdit: { verb: "Editing", nounSingular: "file", nounPlural: "files" },
  Write: { verb: "Writing", nounSingular: "file", nounPlural: "files" },
  Bash: { verb: "Running", nounSingular: "command", nounPlural: "commands" },
  BashOutput: { verb: "Checking", nounSingular: "output", nounPlural: "outputs" },
  KillBash: { verb: "Killing", nounSingular: "shell", nounPlural: "shells" },
  Grep: { verb: "Searching", nounSingular: "pattern", nounPlural: "patterns" },
  Glob: { verb: "Listing", nounSingular: "path", nounPlural: "paths" },
  TodoWrite: { verb: "Updating", nounSingular: "todos", nounPlural: "todos" },
  WebFetch: { verb: "Fetching", nounSingular: "URL", nounPlural: "URLs" },
  WebSearch: { verb: "Searching", nounSingular: "the web", nounPlural: "the web" },
  Task: { verb: "Running", nounSingular: "subagent", nounPlural: "subagents" },
  NotebookEdit: { verb: "Editing", nounSingular: "notebook", nounPlural: "notebooks" },
  NotebookRead: { verb: "Reading", nounSingular: "notebook", nounPlural: "notebooks" },
};

function actionFor(name: string): Action {
  if (TOOL_ACTIONS[name]) return TOOL_ACTIONS[name];
  if (name.startsWith("mcp__")) {
    return { verb: "Calling", nounSingular: "MCP tool", nounPlural: "MCP tools" };
  }
  return { verb: "Calling", nounSingular: "tool", nounPlural: "tools" };
}

/**
 * Derive a generic action-form label from a batch of tool calls.
 * Used when the model didn't emit prose before this chunk.
 *
 *   3 Reads → "Reading 3 files"
 *   2 Reads + 1 Bash → "Reading 2 files, running command"
 *   5 Reads → "Reading 5 files"
 *   3 different tools → first two phrases, then "and more"
 */
export function deriveToolActionLabel(blocks: ToolUseBlock[]): string {
  if (blocks.length === 0) return "";

  const counts = new Map<string, number>();
  for (const b of blocks) {
    counts.set(b.name, (counts.get(b.name) ?? 0) + 1);
  }

  // Group by action (so Edit + MultiEdit merge under "Editing files").
  const byAction = new Map<string, { action: Action; count: number }>();
  for (const [name, count] of counts.entries()) {
    const action = actionFor(name);
    const key = `${action.verb}|${action.nounPlural}`;
    const prev = byAction.get(key);
    if (prev) prev.count += count;
    else byAction.set(key, { action, count });
  }

  const phrases = Array.from(byAction.values())
    .sort((a, b) => b.count - a.count)
    .map(({ action, count }) => {
      const noun = count === 1 ? action.nounSingular : action.nounPlural;
      if (action.nounPlural === "the web") return action.verb + " the web";
      return `${action.verb} ${count} ${noun}`;
    });

  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) {
    return `${phrases[0]}, ${phrases[1].charAt(0).toLowerCase() + phrases[1].slice(1)}`;
  }
  return `${phrases[0]}, ${phrases[1].charAt(0).toLowerCase() + phrases[1].slice(1)}, and more`;
}
