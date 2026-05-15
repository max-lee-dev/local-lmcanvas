import type { WebContents } from "electron";
import type { Attachment } from "@shared/ipc";

export type RunnerEvent =
  | { kind: "text_delta"; text: string }
  | { kind: "tool_use"; toolUseId: string; name: string; input: unknown }
  | { kind: "tool_result"; toolUseId: string; content: string; isError: boolean }
  | { kind: "thinking_delta"; text: string }
  | { kind: "done"; isError?: boolean; result?: string }
  | { kind: "error"; message: string };

export type RunAgentOpts = {
  cwd: string;
  model?: string;
  systemPrompt?: string;
  attachments?: Attachment[];
  signal?: AbortSignal;
  binPath?: string;
  // webContents/nodeId are claude-specific (askUser MCP), but kept required so
  // the IPC handler can pass a single opts object to any provider runner.
  webContents: WebContents;
  nodeId: string;
  onEvent: (ev: RunnerEvent) => void;
};

export function composePromptWithSystem(prompt: string, systemPrompt?: string): string {
  if (!systemPrompt || systemPrompt.length === 0) return prompt;
  return `[System]\n${systemPrompt}\n\n[User]\n${prompt}`;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
