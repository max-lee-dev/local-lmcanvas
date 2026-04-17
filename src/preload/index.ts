import { contextBridge, ipcRenderer } from "electron";
import type { ChatEvent, ChatStartArgs, LmcApi } from "@shared/ipc";
import type { AppSettings, Canvas } from "@shared/types";

const api: LmcApi = {
  canvases: {
    list: () => ipcRenderer.invoke("canvases:list"),
    create: (name) => ipcRenderer.invoke("canvases:create", name),
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
};

contextBridge.exposeInMainWorld("api", api);
