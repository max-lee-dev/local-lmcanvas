import type { Provider } from "@shared/types";
import { runClaude } from "../claude/runner";
import { runCodex } from "./codex";
import { runCursor } from "./cursor";
import type { RunAgentOpts, RunnerEvent } from "./types";

export type { RunAgentOpts, RunnerEvent };
export type AgentRunner = (prompt: string, opts: RunAgentOpts) => Promise<void>;

export async function runAgent(
  provider: Provider,
  prompt: string,
  opts: RunAgentOpts
): Promise<void> {
  switch (provider) {
    case "claude":
      return runClaude(prompt, opts);
    case "codex":
      return runCodex(prompt, opts);
    case "cursor":
      return runCursor(prompt, opts);
  }
}
