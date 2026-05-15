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

export type Message = {
  id: string;
  role: "user" | "assistant";
  blocks: ContentBlock[];
  createdAt: number;
  status?: MessageStatus;
  error?: string;
};

export type ChatData = {
  messages: Message[];
  parentIds: NodeId[];
  childIds: NodeId[];
  addedContext?: string;
};

export type CanvasNodeType = "custom" | "stickyNote";

export type CanvasNode = {
  id: NodeId;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: {
    title?: string;
    chat: ChatData;
    stickyText?: string;
  };
};

export type CanvasEdge = {
  id: string;
  source: NodeId;
  target: NodeId;
  sourceHandle?: string;
  targetHandle?: string;
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
  cwd: string;
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
  cwd: string;
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
};
