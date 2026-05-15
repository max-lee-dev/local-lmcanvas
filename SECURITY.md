# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories:

https://github.com/max-lee-dev/local-lmcanvas/security/advisories/new

**Do not open public GitHub issues for vulnerabilities.**

Include in your report:

- Affected version or commit SHA
- Reproduction steps
- Impact (what an attacker can do)
- Suggested fix, if you have one

You can expect a best-effort acknowledgement within 7 days.

## Threat model

`local-lmcanvas` is a local desktop app. It does not listen on any port and makes no outbound network requests of its own.

- The main attack surface is the IPC bridge between the renderer and main process. The contextBridge surface lives in `src/preload/index.ts`; everything the renderer can do to the system goes through there.
- Canvas IDs are sanitized in `src/main/storage/` before being used as filenames, to prevent path traversal into or out of `~/.local-lmcanvas/canvases/`.
- The app spawns the user's local `claude` CLI binary (and optionally `codex`, `cursor-agent`) as a subprocess. A compromised CLI binary on the user's machine would compromise the app. This is by design — bring-your-own-CLI is a core property, not a bug.

## Telemetry

Zero telemetry. Zero outbound network from the app itself. The only network traffic is whatever your local LLM CLI makes on your behalf.
