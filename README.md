# local-lmcanvas

A fully local, canvas-based branching AI conversation tool. Uses the **Claude Code CLI** (`claude -p --output-format stream-json`) as its LLM backend — no API keys, no cloud, no database.

Each conversation is a tree of message nodes on a canvas. Branch from any node to fork the conversation history, or select text in a response and branch from that phrase. Everything persists to `~/.local-lmcanvas/`.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (`claude` binary in `$PATH`)
- Node.js 20+
- macOS / Linux / WSL

Verify Claude Code works:

```bash
claude -p "say hi" --output-format stream-json --verbose | head
```

You should see a stream of JSON events.

## Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

## How it works

- **`app/api/chat`** spawns `claude -p` as a subprocess, parses `stream_event.content_block_delta` events, and streams deltas back to the browser via Server-Sent Events.
- **`app/api/canvases`** reads/writes canvas JSON files under `~/.local-lmcanvas/canvases/`.
- **`components/Canvas/Canvas.tsx`** renders the graph with `@xyflow/react` v12.
- **`hooks/useCanvasStore.ts`** is a Zustand store; any mutation schedules a debounced save.

## Storage

All data lives in `~/.local-lmcanvas/`:

```
~/.local-lmcanvas/
├── canvases/
│   └── <id>.json        # one file per canvas
└── settings.json        # system prompt, claude binary path, etc.
```

Files are human-readable JSON.

## Keyboard shortcuts

| key                    | action                             |
| ---------------------- | ---------------------------------- |
| `⌘+Enter`              | submit prompt in the focused input |
| `⌘+B`                  | branch from the selected node      |
| `Backspace` / `Delete` | delete the selected node           |
| double-click empty pane | create a new root node            |

## Settings

Click the gear icon on the home page or canvas header. You can override:

- **system prompt** — appended to every turn via `--append-system-prompt`
- **claude binary path** — if `claude` isn't on `$PATH` (default: `claude`)
- **model** — optional, e.g. `claude-opus-4-7`; blank uses whatever Claude Code picks

## Troubleshooting

**"claude binary not found"** — the `claude` command isn't on `$PATH`. Either install Claude Code globally or set the full path in Settings (e.g. `/Users/you/.local/bin/claude`).

**Responses don't stream** — we use `--include-partial-messages` for true streaming deltas. If your Claude Code version predates that flag, short responses may arrive all at once. Upgrade with `claude update`.

**Canvas won't load** — check `~/.local-lmcanvas/canvases/<id>.json` for a corrupt file; delete it if needed.
