export type NodeId = string;

export type MessageStatus = "streaming" | "complete" | "error";

export type TextBlock = { type: "text"; text: string };

export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
  result?: { content: string; isError: boolean };
};

export type ThinkingBlock = { type: "thinking"; text: string };

export type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export type ImageBlock = {
  type: "image";
  mediaType: ImageMediaType;
  base64: string;
};

export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock | ImageBlock;

export type ErrorCode = "auth_required" | "policy_refusal";

export type UsageSummary = {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
  totalCostUsd?: number;
};

/** A model-proposed follow-up action. Rendered as a button under the assistant message;
 *  clicking creates a child node prefilled with `prompt` and auto-submits it. */
export type Suggestion = { label: string; prompt: string };

export type ModelFallback = {
  fromModel: string;
  toModel: string;
  reason: "policy_refusal" | "highRiskCyberActivity";
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  blocks: ContentBlock[];
  createdAt: number;
  /** Provider that generated this assistant message. */
  provider?: Provider;
  /** Per-message token/cost usage, when reported by the provider CLI. */
  usage?: UsageSummary;
  status?: MessageStatus;
  error?: string;
  /** Machine-readable error category — drives in-UI affordances like "Re-authenticate". */
  errorCode?: ErrorCode;
  /** Which provider produced the error (so the UI can guide re-auth). */
  errorProvider?: Provider;
  /** Records a transparent automatic retry with a different model. */
  modelFallback?: ModelFallback;
  /** Parsed from a trailing `<next-steps>` block in the model's response. */
  suggestions?: Suggestion[];
};

export type ChatData = {
  messages: Message[];
  parentIds: NodeId[];
  childIds: NodeId[];
  /** Provider-native conversation state captured after this node completes. */
  providerSession?: ProviderSessionRef;
  addedContext?: string;
  /** When true, the node auto-deletes 10s after its assistant message completes,
   *  unless hovered (hover resets the countdown). Set when the user creates a
   *  follow-up via the Timer half of the selection split-button. */
  isTemporary?: boolean;
};

export type CanvasNodeType = "custom" | "stickyNote";

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

export type CodexServiceTier = "standard" | "fast";

export type CodexModelServiceTier = {
  id: string;
  name: string;
  description: string;
};

export type CodexModelInfo = {
  id: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  supportedReasoningEfforts: ReasoningEffort[];
  defaultReasoningEffort: ReasoningEffort;
  serviceTiers: CodexModelServiceTier[];
  defaultServiceTier?: string;
};

export type CodexRuntimeInfo = {
  models: CodexModelInfo[];
  defaultModelId?: string;
  /** User-agent reported by the running Codex app-server. */
  codexUserAgent?: string;
  protocolVersion: 2;
};

export type ProviderSessionRef = {
  provider: Provider;
  /** Claude session UUID or Codex app-server thread ID. */
  id: string;
};

export const REASONING_EFFORTS: readonly ReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
] as const;

export type NodeSettings = {
  provider?: Provider;
  cwd?: string;
  /** Free-text branch label set by the user. No git detection. */
  branch?: string;
  /** When true, the SDK runs in plan mode — model proposes a plan, cannot use mutating tools. Claude-only. */
  planMode?: boolean;
  /** When true, skip the claude_code preset and disable agent tools — fast pure-chat path. Claude-only. */
  chatOnly?: boolean;
  /** Reasoning-effort override for providers that support it. Codex-only today. */
  reasoningEffort?: ReasoningEffort;
  /** Codex processing tier override. */
  serviceTier?: CodexServiceTier;
};

export type CanvasNode = {
  id: NodeId;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: {
    title?: string;
    chat: ChatData;
    stickyText?: string;
    /** User-resized node width in flow units. Falls back to NODE_WIDTH. */
    width?: number;
    /** Per-node overrides for provider / cwd / branch. Falls back to canvas defaults. */
    nodeSettings?: NodeSettings;
  };
};

export type CanvasEdge = {
  id: string;
  source: NodeId;
  target: NodeId;
  sourceHandle?: string;
  targetHandle?: string;
  /**
   * Pixel offset along the parent's local Y axis where the edge should attach,
   * captured at child-creation time so the connector emerges near the point
   * the user was looking at (cursor on right-click, or selection on branch).
   * Undefined → use default handle-based routing.
   */
  sourceYOffset?: number;
};

export type Provider = "claude" | "codex" | "cursor";

export const PROVIDERS: readonly Provider[] = ["claude", "codex", "cursor"] as const;

export type ProviderConfig = {
  /** Override the default binary name. */
  binPath?: string;
  /** Optional model override for this provider. */
  model?: string;
  /** Optional reasoning-effort override for providers that support it. */
  reasoningEffort?: ReasoningEffort;
  /** Optional Codex processing tier override. */
  serviceTier?: CodexServiceTier;
};

export type Canvas = {
  id: string;
  name: string;
  /** Default working directory inherited by nodes that don't override it. */
  cwd?: string;
  createdAt: number;
  updatedAt: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** Which provider this canvas uses. Falls back to AppSettings.defaultProvider. */
  provider?: Provider;
};

export type CanvasSummary = {
  id: string;
  name: string;
  cwd?: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  provider?: Provider;
};

export type AppSettings = {
  systemPrompt?: string;
  /** @deprecated kept for back-compat; mirrors providers.claude.model */
  claudeModel?: string;
  /** @deprecated kept for back-compat; mirrors providers.claude.binPath */
  claudeBinPath?: string;
  defaultProvider?: Provider;
  providers?: Partial<Record<Provider, ProviderConfig>>;
  onboardingCompleted?: boolean;
  terseToolNarration?: boolean;
  /** MRU folder paths picked anywhere in the app, newest first. Capped. */
  recentFolders?: string[];
  /** MRU branch labels typed anywhere in the app, newest first. Capped. */
  recentBranches?: string[];
  /** Last node-level overrides applied anywhere; used to seed new orphan nodes. */
  lastNodeSettings?: NodeSettings;
};
