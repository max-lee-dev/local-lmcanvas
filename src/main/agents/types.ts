import type { WebContents } from "electron";
import type { Attachment } from "@shared/ipc";
import type {
  CodexServiceTier,
  ErrorCode,
  ModelFallback,
  ProviderSessionRef,
  ReasoningEffort,
  UsageSummary,
} from "@shared/types";

export type RunnerEvent =
  | { kind: "text_delta"; text: string }
  | { kind: "response_complete" }
  | { kind: "session"; session: ProviderSessionRef }
  | { kind: "tool_use"; toolUseId: string; name: string; input: unknown }
  | { kind: "tool_result"; toolUseId: string; content: string; isError: boolean }
  | { kind: "thinking_delta"; text: string }
  | ({ kind: "model_fallback" } & ModelFallback)
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

const POLICY_REFUSAL_PATTERNS: RegExp[] = [
  /unable to respond to this request.*usage policy/is,
  /request was blocked.*terms of service/is,
  /restrictions on reverse engineering or duplicating model outputs/i,
];

export function isPolicyRefusal(message: string): boolean {
  if (!message) return false;
  return POLICY_REFUSAL_PATTERNS.some((re) => re.test(message));
}

export type RunAgentOpts = {
  cwd: string;
  model?: string;
  systemPrompt?: string;
  attachments?: Attachment[];
  signal?: AbortSignal;
  binPath?: string;
  /** Reasoning effort for providers that support it. Codex-only today. */
  reasoningEffort?: ReasoningEffort;
  /** Codex-only processing tier. */
  serviceTier?: CodexServiceTier;
  /** Provider-native state from the primary parent node. */
  parentSession?: ProviderSessionRef;
  /** Provider-native state already owned by this node. */
  currentSession?: ProviderSessionRef;
  /** Claude-only; ignored by codex/cursor runners. */
  planMode?: boolean;
  /** Claude-only; skip the claude_code preset for a fast pure-chat path. Ignored when planMode is also true. */
  chatOnly?: boolean;
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
