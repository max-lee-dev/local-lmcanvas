# local-lmcanvas

A fully local, canvas-based branching AI conversation tool. The Electron app drives your installed Claude, Codex, or Cursor agent harness — no API keys to paste into the app, no database, and no LMCanvas telemetry.

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

## Release

Maintainers can start a signed and notarized macOS release in the background:

```bash
bun run release:start patch
bun run release:status
bun run release:logs
```

Store notarization credentials in the macOS Keychain once, then add only the
profile name to `.env.release`:

```bash
xcrun notarytool store-credentials "lmcanvas-notary" --apple-id "you@example.com" --team-id "TEAMID"
APPLE_KEYCHAIN_PROFILE=lmcanvas-notary
```

`store-credentials` prompts securely for the app-specific password. Avoid
putting `APPLE_APP_SPECIFIC_PASSWORD` in `.env.release`; the legacy env-based
flow remains supported only as a fallback.

The one-shot macOS background job keeps running if the launching terminal closes,
does not restart after completion, and prevents idle sleep while it runs. Release
state and logs live under `~/.local/state/local-lmcanvas/release/`. The repository
must be clean before a release starts. `minor`, `major`, and `--no-bump` are also
supported.

## Architecture

```
src/
├── main/           Electron main process (Node)
│   ├── index.ts    IPC handlers, BrowserWindow setup
│   ├── claude/     Claude Agent SDK session/fork integration
│   ├── agents/     provider adapters and persistent Codex app-server transport
│   └── storage/    reads/writes ~/.local-lmcanvas/
├── preload/        contextBridge: exposes window.api to renderer
├── renderer/       React UI (xyflow canvas, zustand store)
└── shared/         types + graph logic used by both sides
```

All renderer → main calls go over IPC (`window.api.canvases.list()`, etc.).

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

## Contributing

PRs welcome — including AI/vibe-coded ones. See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup, conventions, and how to file issues. AI agents should also read [AGENTS.md](./AGENTS.md).

## Vision

Local-first, canvas-native, bring-your-own-CLI. See [VISION.md](./VISION.md) for the longer take and [CHANGELOG.md](./CHANGELOG.md) for what's shipped.

## Security

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/max-lee-dev/local-lmcanvas/security/advisories/new). See [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © 2026 Max Lee
