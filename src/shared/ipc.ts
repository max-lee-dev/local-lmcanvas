import type { AppSettings, Canvas, CanvasSummary, ImageMediaType, Message } from "./types";

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
};

declare global {
  interface Window {
    api: LmcApi;
  }
}
