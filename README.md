# local-lmcanvas

A fully local, canvas-based branching AI conversation tool. Desktop Electron app that uses the **Claude Code CLI** (`claude -p --output-format stream-json`) as its LLM backend — no API keys, no cloud, no database.

Each conversation is a tree of message nodes on a canvas. Branch from any node to fork the conversation history, or highlight text in a response to branch from that phrase. Everything persists to `~/.local-lmcanvas/`.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (`claude` binary in `$PATH`)
- [Bun](https://bun.sh) 1.1+
- macOS / Linux / Windows

Verify Claude Code works:

```bash
claude -p "say hi" --output-format stream-json --verbose | head
```

## Run

```bash
bun install
bun run dev
```

The Electron window opens automatically. Build a distributable with:

```bash
bun run dist   # .dmg on macOS, .AppImage on Linux, .exe on Windows
```

## Architecture

```
src/
├── main/           Electron main process (Node)
│   ├── index.ts    IPC handlers, BrowserWindow setup
│   ├── claude/     spawns `claude` CLI, parses stream-json
│   └── storage/    reads/writes ~/.local-lmcanvas/
├── preload/        contextBridge: exposes window.api to renderer
├── renderer/       React UI (xyflow canvas, zustand store)
└── shared/         types + graph logic used by both sides
```

All renderer → main calls go over IPC (`window.api.canvases.list()`, etc.) — no HTTP.

## Storage

```
~/.local-lmcanvas/
├── canvases/
│   └── <id>.json        one file per canvas
└── settings.json        system prompt, claude binary path, model
```

Files are human-readable JSON.

## Keyboard shortcuts

| key                    | action                             |
| ---------------------- | ---------------------------------- |
| `⌘+Enter`              | submit prompt in the focused input |
| `⌘+B`                  | branch from the selected node      |
| `Backspace` / `Delete` | delete the selected node           |
| double-click empty pane | create a new root node            |

## Troubleshooting

**"claude binary not found"** — set the full path in Settings (gear icon), e.g. `/Users/you/.local/bin/claude`.

**Blank window** — check the DevTools console (opens automatically in dev). For prod, `bun run dev` once to see errors.

## Anonymous usage

On launch, the app sends one anonymous event (a random UUID + OS + arch + app version) to PostHog so I can see install counts. **No prompts, conversations, file paths, or content are ever sent.** The UUID is generated locally and stored in `~/.local-lmcanvas/settings.json`.

To opt out:

- Toggle **Anonymous usage** off in Settings, or
- Set `LMCANVAS_TELEMETRY=0` in your environment before launching.

See `src/main/telemetry.ts` for the full implementation.
