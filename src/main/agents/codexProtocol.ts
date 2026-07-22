/*
 * Protocol subset derived from openai/codex app-server generated TypeScript
 * definitions (Apache-2.0). Keep wire names in sync with protocol v2.
 */

import type { ReasoningEffort } from "@shared/types";

export type JsonObject = Record<string, unknown>;
export type JsonRpcId = string | number;

export type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

export type JsonRpcNotification = {
  method: string;
  params?: JsonObject;
};

export type JsonRpcServerRequest = {
  id: JsonRpcId;
  method: string;
  params?: JsonObject;
};

export type ThreadSummary = {
  id: string;
  turns?: unknown[];
};

export type ThreadLifecycleResponse = {
  thread: ThreadSummary;
  model: string;
  modelProvider: string;
  serviceTier: string | null;
  reasoningEffort: ReasoningEffort | null;
};

export type TurnStartResponse = {
  turn: { id: string; status?: string };
};

export type ModelWire = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  hidden: boolean;
  isDefault: boolean;
  defaultReasoningEffort: ReasoningEffort;
  supportedReasoningEfforts: Array<{
    reasoningEffort: ReasoningEffort;
    description: string;
  }>;
  serviceTiers?: Array<{ id: string; name: string; description: string }>;
  defaultServiceTier?: string | null;
};

export type ModelListResponse = {
  data: ModelWire[];
  nextCursor: string | null;
};

export type InitializeResponse = {
  userAgent: string;
  codexHome: string;
  platformFamily: string;
  platformOs: string;
};

export type CodexClientRequestMap = {
  initialize: {
    params: JsonObject;
    result: InitializeResponse;
  };
  "model/list": {
    params: { cursor?: string; limit?: number; includeHidden?: boolean };
    result: ModelListResponse;
  };
  "thread/start": { params: JsonObject; result: ThreadLifecycleResponse };
  "thread/resume": { params: JsonObject; result: ThreadLifecycleResponse };
  "thread/fork": { params: JsonObject; result: ThreadLifecycleResponse };
  "thread/unsubscribe": {
    params: { threadId: string };
    result: { status: "unsubscribed" | "notSubscribed" | "notLoaded" };
  };
  "turn/start": { params: JsonObject; result: TurnStartResponse };
  "turn/interrupt": {
    params: { threadId: string; turnId: string };
    result: JsonObject;
  };
};

export type ToolRequestUserInputOption = {
  label: string;
  description: string;
};

export type ToolRequestUserInputQuestion = {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: ToolRequestUserInputOption[] | null;
};

export type ToolRequestUserInputParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  questions: ToolRequestUserInputQuestion[];
  autoResolutionMs: number | null;
};

export type CommandApprovalParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  command?: string | null;
  cwd?: string | null;
  reason?: string | null;
};

export type FileChangeApprovalParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  reason?: string | null;
  grantRoot?: string | null;
};

export type McpElicitationPropertySchema = JsonObject & {
  type?: "string" | "number" | "integer" | "boolean" | "array";
  title?: string;
  description?: string;
  enum?: string[];
  enumNames?: string[];
  oneOf?: Array<{ const: string; title: string }>;
  items?: JsonObject;
};

export type McpServerElicitationParams = JsonObject & {
  threadId: string;
  turnId: string | null;
  serverName: string;
  mode: "form" | "openai/form" | "url";
  message: string;
  requestedSchema?: JsonObject;
  url?: string;
  elicitationId?: string;
};

export type CodexServerRequestMap = {
  "item/tool/requestUserInput": ToolRequestUserInputParams;
  "item/commandExecution/requestApproval": CommandApprovalParams;
  "item/fileChange/requestApproval": FileChangeApprovalParams;
  "item/permissions/requestApproval": JsonObject;
  "mcpServer/elicitation/request": McpServerElicitationParams;
  "item/tool/call": JsonObject;
  "account/chatgptAuthTokens/refresh": JsonObject;
  "attestation/generate": JsonObject;
  "currentTime/read": { threadId: string };
  applyPatchApproval: JsonObject;
  execCommandApproval: JsonObject;
};

export type CodexServerRequestMethod = keyof CodexServerRequestMap;

export type TurnPlanStep = {
  step: string;
  status: "pending" | "inProgress" | "completed";
};

export type TurnPlanUpdatedParams = {
  threadId: string;
  turnId: string;
  explanation: string | null;
  plan: TurnPlanStep[];
};

export type ModelReroutedParams = {
  threadId: string;
  turnId: string;
  fromModel: string;
  toModel: string;
  reason: string;
};

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === "string" || typeof value === "number";
}

export function isServerRequestMethod(
  method: string,
): method is CodexServerRequestMethod {
  return SERVER_REQUEST_METHODS.has(method as CodexServerRequestMethod);
}

const SERVER_REQUEST_METHODS = new Set<CodexServerRequestMethod>([
  "item/tool/requestUserInput",
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "mcpServer/elicitation/request",
  "item/tool/call",
  "account/chatgptAuthTokens/refresh",
  "attestation/generate",
  "currentTime/read",
  "applyPatchApproval",
  "execCommandApproval",
]);
