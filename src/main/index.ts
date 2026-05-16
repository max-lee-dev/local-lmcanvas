import { app, BrowserWindow, ipcMain, Menu, MenuItem, nativeImage, shell, dialog } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  listCanvases,
  createCanvas,
  readCanvas,
  writeCanvas,
  deleteCanvas,
} from "./storage/canvases";
import { readSettings, writeSettings } from "./storage/settings";
import { buildPromptWithHistory } from "./claude/history";
import { runAgent } from "./agents";
import { getProviderAuthStatus, openLoginTerminal } from "./auth/providerAuth";
import { listFiles } from "./files";
import { listSlashItems } from "./slashItems";
import {
  cancelAllForWebContents,
  completeRequest as completeAskUser,
} from "./claude/askUserBridge";
import { getShellPath } from "./shellPath";
import { initAutoUpdate, checkForUpdatesNow } from "./autoUpdate";
import type {
  AskUserResponsePayload,
  ChatEvent,
  ChatStartArgs,
  CanvasCreateArgs,
  FileEntry,
  SlashItem,
} from "@shared/ipc";
import type { AppSettings, Canvas, Provider } from "@shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dev: __dirname is .../out/main → ../../resources is the project resources/.
// Packaged: electron-builder copies resources/ to process.resourcesPath/resources.
const APP_ICON_PATH = app.isPackaged
  ? join(process.resourcesPath, "resources/icon.png")
  : join(__dirname, "../../resources/icon.png");

function createWindow(hash?: string): BrowserWindow {
  const icon = nativeImage.createFromPath(APP_ICON_PATH);

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 360,
    minHeight: 480,
    title: "LMCanvas",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#fafafa",
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  if (process.platform === "darwin" && app.dock && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  win.on("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  const suffix = hash ? `#${hash.replace(/^#/, "")}` : "";
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl + suffix);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: hash?.replace(/^#/, ""),
    });
  }

  return win;
}

type ActiveChat = { controller: AbortController; nodeId: string };
const activeChats = new Map<string, ActiveChat>();

const TERSE_NARRATION_INSTRUCTION =
  "RESPONSE STYLE: Before each batch of tool calls (typically 1–5 parallel calls), write ONE very short action-form label as a single line of text — 3 to 8 words, gerund form. Examples: 'Reading the canvas store', 'Searching for tool handlers', 'Editing the badge component', 'Digging into group summaries'. Do NOT use first-person prefixes like 'I'll', 'Let me', 'I'm going to', 'Now I will'. Do NOT describe each result after a tool returns. When you fire a long sequence of tool calls without natural pauses, insert a fresh action-form label every ~5 calls so the user can see what each phase is doing. Save longer prose for your final answer to the user.";

// Asks the model to optionally end with a `<next-steps>` block listing 1–3
// follow-up prompts. The renderer strips this block from the visible text and
// renders each item as a clickable button that branches into a new child node.
const NEXT_STEPS_INSTRUCTION = `SUGGESTED NEXT STEPS: When — and only when — there are 1–3 obvious follow-up actions the user is likely to want next, end your response with a block in this exact format:

<next-steps>
- Short label :: Full prompt the user could send as the next message
- Short label :: Full prompt the user could send as the next message
</next-steps>

Rules:
- Place the block at the very end of your response, after all other content. Nothing follows it.
- Each item is on its own line, starts with "- ", and uses " :: " (space-colon-colon-space) as the separator.
- Label is ≤6 words, sentence case, no trailing punctuation.
- Prompt is a complete, standalone instruction the user could send verbatim.
- 0–3 items. If nothing obvious comes to mind, omit the block entirely — do NOT force suggestions.
- Never wrap the block in code fences or markdown. Never reference it in the prose above.`;

const FILES_CACHE_TTL_MS = 10_000;
const filesCache = new Map<string, { at: number; files: FileEntry[] }>();

const SLASH_CACHE_TTL_MS = 10_000;
const slashCache = new Map<string, { at: number; items: SlashItem[] }>();

function registerIpc(): void {
  ipcMain.handle("canvases:list", async () => listCanvases());
  ipcMain.handle("canvases:create", async (_e, args: CanvasCreateArgs) => createCanvas(args));
  ipcMain.handle("canvases:read", async (_e, id: string) => readCanvas(id));
  ipcMain.handle("canvases:write", async (_e, canvas: Canvas) => writeCanvas(canvas));
  ipcMain.handle("canvases:delete", async (_e, id: string) => deleteCanvas(id));

  ipcMain.handle("settings:read", async () => readSettings());
  ipcMain.handle("settings:write", async (_e, s: AppSettings) => writeSettings(s));

  ipcMain.handle("dialog:pickFolder", async (_e, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      defaultPath,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("shell:openPath", async (_e, path: string) => {
    await shell.openPath(path);
  });

  ipcMain.handle("files:list", async (_e, cwd: string): Promise<FileEntry[]> => {
    if (!cwd) return [];
    const now = Date.now();
    const cached = filesCache.get(cwd);
    if (cached && now - cached.at < FILES_CACHE_TTL_MS) return cached.files;
    const files = await listFiles(cwd);
    filesCache.set(cwd, { at: now, files });
    return files;
  });

  ipcMain.handle("slash:list", async (_e, cwd: string): Promise<SlashItem[]> => {
    const key = cwd ?? "";
    const now = Date.now();
    const cached = slashCache.get(key);
    if (cached && now - cached.at < SLASH_CACHE_TTL_MS) return cached.items;
    const items = await listSlashItems(key);
    slashCache.set(key, { at: now, items });
    return items;
  });

  ipcMain.handle("chat:start", async (e, args: ChatStartArgs) => {
    const {
      chatId,
      nodeId,
      canvasId,
      history,
      prompt,
      attachments,
      systemPromptOverride,
      nodeSettings,
      planMode: inlinePlanMode,
    } = args;
    const sender = e.sender;

    const send = (ev: ChatEvent) => {
      if (sender.isDestroyed()) return;
      sender.send("chat:event", ev);
    };

    const canvas = await readCanvas(canvasId);
    if (!canvas) {
      send({ chatId, type: "error", message: `Canvas not found: ${canvasId}` });
      send({ chatId, type: "done", isError: true });
      return;
    }

    const settings = await readSettings();
    const combinedPrompt = buildPromptWithHistory(history, prompt);
    const basePrompt = systemPromptOverride ?? settings.systemPrompt ?? "";
    const withTerse = settings.terseToolNarration
      ? basePrompt
        ? `${basePrompt}\n\n${TERSE_NARRATION_INSTRUCTION}`
        : TERSE_NARRATION_INSTRUCTION
      : basePrompt;
    const systemPrompt = withTerse
      ? `${withTerse}\n\n${NEXT_STEPS_INSTRUCTION}`
      : NEXT_STEPS_INSTRUCTION;

    const provider: Provider =
      nodeSettings?.provider ?? canvas.provider ?? settings.defaultProvider ?? "claude";
    const providerCfg = settings.providers?.[provider];
    const binPath =
      providerCfg?.binPath ??
      (provider === "claude" ? settings.claudeBinPath : undefined);
    const model =
      providerCfg?.model ??
      (provider === "claude" ? settings.claudeModel : undefined);

    // Effective cwd: node override → canvas → user home (least-invasive fallback so
    // every provider runner — which require a string cwd — always has one).
    const effectiveCwd = nodeSettings?.cwd ?? canvas.cwd ?? homedir();

    // Plan mode resolves as: one-shot inline /plan OR persistent node setting.
    // Claude-only — codex/cursor runners ignore the flag.
    const planMode = Boolean(inlinePlanMode) || Boolean(nodeSettings?.planMode);

    const controller = new AbortController();
    activeChats.set(chatId, { controller, nodeId });

    send({ chatId, type: "start" });

    try {
      await runAgent(provider, combinedPrompt, {
        cwd: effectiveCwd,
        model,
        binPath,
        systemPrompt,
        attachments,
        signal: controller.signal,
        planMode,
        webContents: sender,
        nodeId,
        onEvent: (ev) => {
          switch (ev.kind) {
            case "text_delta":
              send({ chatId, type: "text_delta", text: ev.text });
              return;
            case "thinking_delta":
              send({ chatId, type: "thinking_delta", text: ev.text });
              return;
            case "tool_use":
              send({
                chatId,
                type: "tool_use",
                toolUseId: ev.toolUseId,
                name: ev.name,
                input: ev.input,
              });
              return;
            case "tool_result":
              send({
                chatId,
                type: "tool_result",
                toolUseId: ev.toolUseId,
                content: ev.content,
                isError: ev.isError,
              });
              return;
            case "error":
              send({
                chatId,
                type: "error",
                message: ev.message,
                code: ev.code,
                provider,
              });
              return;
            case "done":
              send({
                chatId,
                type: "done",
                isError: ev.isError,
                result: ev.result,
                code: ev.code,
                provider: ev.isError ? provider : undefined,
              });
              return;
          }
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      send({ chatId, type: "error", message, provider });
      send({ chatId, type: "done", isError: true, provider });
    } finally {
      activeChats.delete(chatId);
    }
  });

  ipcMain.handle("chat:cancel", async (e, chatId: string) => {
    activeChats.get(chatId)?.controller.abort();
    activeChats.delete(chatId);
    cancelAllForWebContents(e.sender);
  });

  ipcMain.handle("chat:cancelForNode", async (_e, nodeId: string) => {
    for (const [chatId, entry] of activeChats) {
      if (entry.nodeId !== nodeId) continue;
      entry.controller.abort();
      activeChats.delete(chatId);
    }
  });

  ipcMain.handle("askUser:respond", async (_e, payload: AskUserResponsePayload) => {
    completeAskUser(payload);
  });

  ipcMain.handle("providers:authStatus", async (_e, provider: Provider) => {
    const settings = await readSettings();
    const binPath =
      settings.providers?.[provider]?.binPath ??
      (provider === "claude" ? settings.claudeBinPath : undefined);
    return getProviderAuthStatus(provider, binPath);
  });

  ipcMain.handle("providers:openLogin", async (_e, provider: Provider) => {
    const settings = await readSettings();
    const binPath =
      settings.providers?.[provider]?.binPath ??
      (provider === "claude" ? settings.claudeBinPath : undefined);
    await openLoginTerminal(provider, binPath);
  });

  ipcMain.handle("window:openCanvas", async (_e, canvasId?: string) => {
    const hash = canvasId ? `/canvas/${canvasId}` : "/";
    createWindow(hash);
  });
}

function installUpdateMenuItem(): void {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  // On macOS the app menu is index 0 ("LMCanvas" / Electron's default). Insert
  // "Check for Updates…" right after "About" so it sits where users expect.
  const appMenu = menu.items[0];
  const submenu = appMenu?.submenu;
  if (!submenu) return;
  const aboutIdx = submenu.items.findIndex((i) => i.role === "about");
  const insertAt = aboutIdx >= 0 ? aboutIdx + 1 : 0;
  submenu.insert(
    insertAt,
    new MenuItem({
      label: "Check for Updates…",
      click: () => checkForUpdatesNow(),
    }),
  );
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // macOS GUI apps inherit a minimal PATH that lacks /opt/homebrew/bin,
  // ~/.nvm/.../bin, ~/.local/bin etc. — resolve the user's shell PATH so
  // every spawned CLI (including the one inside claude-agent-sdk) can find
  // its binary.
  try {
    process.env.PATH = await getShellPath();
  } catch {
    // best-effort; fall through with whatever PATH we have
  }

  registerIpc();
  createWindow();
  initAutoUpdate();
  installUpdateMenuItem();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
