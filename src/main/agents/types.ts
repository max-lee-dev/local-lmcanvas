import type { WebContents } from "electron";
import type { Attachment } from "@shared/ipc";
import type { ErrorCode, UsageSummary } from "@shared/types";

export type RunnerEvent =
  | { kind: "text_delta"; text: string }
  | { kind: "tool_use"; toolUseId: string; name: string; input: unknown }
  | { kind: "tool_result"; toolUseId: string; content: string; isError: boolean }
  | { kind: "thinking_delta"; text: string }
  | {
      kind: "done";
      isError?: boolean;
      result?: string;
      code?: ErrorCode;
      usage?: UsageSummary;
    }
  | { kind: "error"; message: string; code?: ErrorCode };

const AUTH_PATTERNS: RegExp[] = [
  /\b(not\s+(?:logged|signed)\s+in|not\s+authenticated)\b/i,
  /\b(unauthorized|401|403)\b/i,
  /\b(authentication\s+failed|auth\s+failed)\b/i,
  /\b(token|session)\s+(?:has\s+)?expired\b/i,
  /please\s+(?:run\s+)?(?:[`'"]?\S+[`'"]?\s+)?log(?:\s+in|in)/i,
  /run\s+[`'"]?\S+\s+login[`'"]?/i,
  /sign\s+in\s+(?:with|to)/i,
  /api[\s_-]?key\s+(?:invalid|missing|required)/i,
];

export function isAuthError(message: string): boolean {
  if (!message) return false;
  return AUTH_PATTERNS.some((re) => re.test(message));
}

export type RunAgentOpts = {
  cwd: string;
  model?: string;
  systemPrompt?: string;
  attachments?: Attachment[];
  signal?: AbortSignal;
  binPath?: string;
  /** Claude-only; ignored by codex/cursor runners. */
  planMode?: boolean;
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
