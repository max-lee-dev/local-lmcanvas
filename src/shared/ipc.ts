import type {
  AppSettings,
  Canvas,
  CanvasSummary,
  ErrorCode,
  ImageMediaType,
  Message,
  Provider,
} from "./types";

export type AskUserOption = {
  label: string;
  description: string;
  preview?: string;
};

export type AskUserQuestion = {
  question: string;
  header: string;
  multiSelect: boolean;
  options: AskUserOption[];
};

export type AskUserRequest = {
  /** Correlates this request with the response. */
  id: string;
  /** The node that initiated the chat which triggered this question. */
  nodeId: string;
  questions: AskUserQuestion[];
};

/** Per-question answers. Single-select → string; multi-select → string[]. */
export type AskUserAnswers = Record<string, string | string[]>;

export type AskUserResponsePayload =
  | { id: string; cancelled: false; answers: AskUserAnswers; notes?: Record<string, string> }
  | { id: string; cancelled: true };


export type Attachment = {
  mediaType: ImageMediaType;
  base64: string;
};

export type FileEntry = {
  path: string;
  type: "file" | "dir";
};

export type SlashItemKind = "command" | "skill";
export type SlashItemSource = "user" | "project" | "plugin";

export type SlashItem = {
  kind: SlashItemKind;
  /** Name without the leading slash. Namespaced commands use `ns:name`. */
  name: string;
  /** One-line description from frontmatter (skills) or first paragraph (commands). */
  description: string;
  source: SlashItemSource;
};

export type ChatStartArgs = {
  chatId: string;
  /** The node initiating the chat — surfaced to the askUser flow so prompts render inline. */
  nodeId: string;
  canvasId: string;
  history: Message[];
  prompt: string;
  attachments?: Attachment[];
  systemPromptOverride?: string;
};

export type ChatEvent =
  | { chatId: string; type: "start" }
  | { chatId: string; type: "text_delta"; text: string }
  | {
      chatId: string;
      type: "tool_use";
      toolUseId: string;
      name: string;
      input: unknown;
    }
  | {
      chatId: string;
      type: "tool_result";
      toolUseId: string;
      content: string;
      isError: boolean;
    }
  | { chatId: string; type: "thinking_delta"; text: string }
  | {
      chatId: string;
      type: "done";
      isError?: boolean;
      result?: string;
      code?: ErrorCode;
      provider?: Provider;
    }
  | {
      chatId: string;
      type: "error";
      message: string;
      code?: ErrorCode;
      provider?: Provider;
    };

export type CanvasCreateArgs = {
  name: string;
  cwd: string;
  provider?: Provider;
};

export type ProviderAuthStatus = {
  provider: Provider;
  installed: boolean;
  authenticated: boolean;
  binPath: string | null;
  /** Optional message — e.g. version string when ok, or error explanation when not. */
  detail?: string;
};

export type LmcApi = {
  canvases: {
    list(): Promise<CanvasSummary[]>;
    create(args: CanvasCreateArgs): Promise<Canvas>;
    read(id: string): Promise<Canvas | null>;
    write(canvas: Canvas): Promise<void>;
    delete(id: string): Promise<void>;
  };
  settings: {
    read(): Promise<AppSettings>;
    write(s: AppSettings): Promise<AppSettings>;
  };
  chat: {
    start(args: ChatStartArgs): Promise<void>;
    cancel(chatId: string): Promise<void>;
    /** Cancel any in-progress chats associated with the given node. */
    cancelForNode(nodeId: string): Promise<void>;
    onEvent(handler: (ev: ChatEvent) => void): () => void;
  };
  dialog: {
    pickFolder(defaultPath?: string): Promise<string | null>;
  };
  shell: {
    openPath(path: string): Promise<void>;
  };
  files: {
    list(cwd: string): Promise<FileEntry[]>;
  };
  slash: {
    /** List slash commands + skills available from `~/.claude` and the canvas cwd. */
    list(cwd: string): Promise<SlashItem[]>;
  };
  providers: {
    /** Probe a provider's CLI install + auth state. */
    authStatus(provider: Provider): Promise<ProviderAuthStatus>;
    /** Open a shell session to run `<bin> login` for the given provider, in the user's terminal. */
    openLoginTerminal(provider: Provider): Promise<void>;
  };
  askUser: {
    /** Subscribe to incoming ask-user requests from the agent. Returns an unsubscribe function. */
    onRequest(handler: (req: AskUserRequest) => void): () => void;
    /** Send the user's answers (or cancellation) back to the agent. */
    respond(payload: AskUserResponsePayload): Promise<void>;
  };
  window: {
    /** Open a new app window. If `canvasId` is provided, the new window opens directly on that canvas. */
    openCanvas(canvasId?: string): Promise<void>;
  };
};

declare global {
  interface Window {
    api: LmcApi;
  }
}
