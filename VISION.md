# Vision

## What it is

`local-lmcanvas` is a canvas-native UI for branching AI conversations. Each conversation is a tree of nodes on an infinite canvas — fork from any reply, or highlight a phrase inside a response and branch from that.

It is local-first and bring-your-own-CLI: it drives whatever LLM CLI you've already installed and authenticated (`claude`, `codex`, `cursor-agent`) as a subprocess. No API keys to paste into the app, no accounts, no cloud.

## What it isn't

- Not a cloud product.
- Not a multi-user collaboration tool.
- Not a hosted SaaS.
- Not an LLM API wrapper — it shells out to a CLI you already trust.
- Not an agent framework.

If you want any of those, there are good options elsewhere. This one stays small and stays on your machine.

## Principles

- **Local-first.** All canvases and settings live in `~/.local-lmcanvas/`. The app makes no outbound network requests of its own; only your CLI does, on your behalf.
- **Human-readable storage.** Canvases are plain JSON files (`~/.local-lmcanvas/canvases/<id>.json`). You can `grep` them, edit them in a text editor, sync them with whatever you already use (git, rsync, Dropbox, a USB stick).
- **Bring your own CLI.** Authentication, billing, and model choice belong to the CLI you've already set up. The app should not become a second place to manage API keys.
- **Zero telemetry.** Nothing is collected. Nothing is sent.

## Where it's going

Loose direction, no commitments:

- Better branching UX — easier to see and navigate large trees.
- More provider CLIs as they emerge.
- Export to markdown so a canvas can leave the app cleanly.
- Shared canvas templates for common workflows.

PRs welcome, including AI-assisted and vibe-coded ones — open an issue first if it's a big change so we can talk shape before you build.
