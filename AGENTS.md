# AGENTS.md

Guide for AI coding agents (Claude Code, Cursor, Codex, etc.) working in this repo.

## Project

`local-lmcanvas` is a fully-local, canvas-based branching AI conversation tool. Electron 33 + React 19 + TypeScript 5.6 (strict). Uses the Claude Code CLI as its LLM backend; collects no telemetry.

## Build & verify

```bash
bun install
bun run dev         # launches the Electron app
bun run typecheck   # REQUIRED before claiming work complete
bun run build       # production build
```

There are no tests and no lint script. Don't try to run them.

## Project layout

- `src/main/` — Electron main process (Node), IPC handlers, file I/O. Touch for: spawning the LLM CLI, persisting canvases, settings.
- `src/preload/` — `contextBridge`. Touch for: adding new IPC channels exposed to the renderer.
- `src/renderer/` — React UI, xyflow canvas. Touch for: UI changes.
- `src/shared/` — types and graph helpers used by both sides. Touch for: changing the data model or message-history reconstruction.

## Hot files

- `src/main/index.ts` — IPC handler registration and `BrowserWindow` setup.
- `src/shared/history.ts` — graph traversal / message-history reconstruction.
- `src/renderer/src/hooks/useCanvasStore.ts` — Zustand store, ~530 lines.
- `src/renderer/src/components/Canvas/CustomNode.tsx` — node UI, ~550 lines.

## Conventions

- TypeScript strict. No `any` unless a third-party type forces it.
- No `@ts-ignore` / `@ts-expect-error`.
- Minimal comments — names should carry the meaning.
- No backwards-compat shims for code you delete.
- IPC channels: typed in `src/shared/ipc.ts`, registered in `src/main/index.ts`, exposed in `src/preload/index.ts`. Keep all three in sync.

## Before you finish

1. Run `bun run typecheck`.
2. Run `bun run dev` and click through what you changed.
3. Summarize what you did.
