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

export type ErrorCode = "auth_required";

export type Message = {
  id: string;
  role: "user" | "assistant";
  blocks: ContentBlock[];
  createdAt: number;
  status?: MessageStatus;
  error?: string;
  /** Machine-readable error category — drives in-UI affordances like "Re-authenticate". */
  errorCode?: ErrorCode;
  /** Which provider produced the error (so the UI can guide re-auth). */
  errorProvider?: Provider;
};

export type ChatData = {
  messages: Message[];
  parentIds: NodeId[];
  childIds: NodeId[];
  addedContext?: string;
};

export type CanvasNodeType = "custom" | "stickyNote";

export type NodeSettings = {
  provider?: Provider;
  cwd?: string;
  /** Free-text branch label set by the user. No git detection. */
  branch?: string;
};

export type CanvasNode = {
  id: NodeId;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: {
    title?: string;
    chat: ChatData;
    stickyText?: string;
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
