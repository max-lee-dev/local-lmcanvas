import { contextBridge, ipcRenderer } from "electron";
import type {
  AskUserRequest,
  AskUserResponsePayload,
  ChatEvent,
  ChatStartArgs,
  LmcApi,
  CanvasCreateArgs,
} from "@shared/ipc";
import type { AppSettings, Canvas } from "@shared/types";

const api: LmcApi = {
  canvases: {
    list: () => ipcRenderer.invoke("canvases:list"),
    create: (args: CanvasCreateArgs) => ipcRenderer.invoke("canvases:create", args),
    read: (id) => ipcRenderer.invoke("canvases:read", id),
    write: (canvas: Canvas) => ipcRenderer.invoke("canvases:write", canvas),
    delete: (id) => ipcRenderer.invoke("canvases:delete", id),
  },
  settings: {
    read: () => ipcRenderer.invoke("settings:read"),
    write: (s: AppSettings) => ipcRenderer.invoke("settings:write", s),
  },
  chat: {
    start: (args: ChatStartArgs) => ipcRenderer.invoke("chat:start", args),
    cancel: (chatId) => ipcRenderer.invoke("chat:cancel", chatId),
    onEvent: (handler: (ev: ChatEvent) => void) => {
      const listener = (_: Electron.IpcRendererEvent, ev: ChatEvent) => handler(ev);
      ipcRenderer.on("chat:event", listener);
      return () => ipcRenderer.off("chat:event", listener);
    },
  },
  dialog: {
    pickFolder: (defaultPath?: string) =>
      ipcRenderer.invoke("dialog:pickFolder", defaultPath),
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke("shell:openPath", path),
  },
  files: {
    list: (cwd: string) => ipcRenderer.invoke("files:list", cwd),
  },
  askUser: {
    onRequest: (handler: (req: AskUserRequest) => void) => {
      const listener = (_: Electron.IpcRendererEvent, req: AskUserRequest) =>
        handler(req);
      ipcRenderer.on("askUser:request", listener);
      return () => ipcRenderer.off("askUser:request", listener);
    },
    respond: (payload: AskUserResponsePayload) =>
      ipcRenderer.invoke("askUser:respond", payload),
  },
};

contextBridge.exposeInMainWorld("api", api);
