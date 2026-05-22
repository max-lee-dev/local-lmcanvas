import type { ToolUseBlock } from "@shared/types";

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
