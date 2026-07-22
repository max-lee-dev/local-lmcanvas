# Architecture decisions

## 2026-07-21 — Provider-native sessions and latency-sensitive streaming

- A completed chat node records an opaque provider-native session reference.
- A child node forks its primary parent's native session. Codex uses
  `codex app-server` `thread/fork`; Claude uses Agent SDK `resume` with
  `forkSession`. Legacy nodes without a session reference start a native thread
  from the existing reconstructed plain-text history. Multi-parent merge nodes
  also start a new session using their explicit merge context instead of choosing
  one provider session as authoritative.
- Codex uses one long-lived app-server process per configured binary instead of
  spawning `codex exec` for every turn. The renderer consumes native agent,
  reasoning, and command-output deltas.
- Renderer text and thinking deltas are coalesced to roughly one update per
  animation frame. The actively growing text block renders as plain text and is
  parsed as Markdown after completion.
- Automatic LLM-backed canvas and group title calls are removed from the
  interactive path. Deterministic local title/group heuristics avoid consuming a
  provider slot while a user-requested chat is running.
- Local console timing markers cover chat start, first provider event, first
  renderer paint, and completion. They contain IDs, provider, phase, and elapsed
  milliseconds, but no prompt or response content.
