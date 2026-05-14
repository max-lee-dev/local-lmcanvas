import type { AppSettings, Canvas, CanvasSummary, ImageMediaType, Message } from "./types";

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

export type ChatStartArgs = {
  chatId: string;
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
  | { chatId: string; type: "done"; isError?: boolean; result?: string }
  | { chatId: string; type: "error"; message: string };

export type CanvasCreateArgs = {
  name: string;
  cwd: string;
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
    onEvent(handler: (ev: ChatEvent) => void): () => void;
  };
  dialog: {
    pickFolder(defaultPath?: string): Promise<string | null>;
  };
  shell: {
    openPath(path: string): Promise<void>;
  };
  files: {
    list(cwd: string): Promise<string[]>;
  };
  askUser: {
    /** Subscribe to incoming ask-user requests from the agent. Returns an unsubscribe function. */
    onRequest(handler: (req: AskUserRequest) => void): () => void;
    /** Send the user's answers (or cancellation) back to the agent. */
    respond(payload: AskUserResponsePayload): Promise<void>;
  };
};

declare global {
  interface Window {
    api: LmcApi;
  }
}
