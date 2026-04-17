export type NodeId = string;

export type MessageStatus = "streaming" | "complete" | "error";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: MessageStatus;
  error?: string;
};

export type ChatData = {
  messages: Message[];
  parentIds: NodeId[];
  childIds: NodeId[];
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
};

export type Canvas = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type CanvasSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
};

export type AppSettings = {
  systemPrompt?: string;
  claudeModel?: string;
  claudeBinPath?: string;
};
