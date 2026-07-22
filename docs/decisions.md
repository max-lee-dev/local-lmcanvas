# Architecture decisions

## 2026-07-22 — Typed, bidirectional Codex protocol boundary

- LMCanvas maintains a small typed protocol-v2 boundary based on Codex's
  generated Apache-2.0 TypeScript definitions instead of duplicating the entire
  fast-moving upstream schema. A dependency-free drift check compares the
  supported server-request surface and required client methods with upstream.
- JSON-RPC request IDs accept both strings and numbers. Client requests have
  bounded timeouts, and server-initiated requests receive a result or explicit
  JSON-RPC error so Codex cannot wait forever on an unanswered request.
- Native user-input requests, command and file approvals, current-time reads,
  and MCP form/URL elicitations are handled inline. Unsupported dynamic-tool,
  token-refresh, and attestation requests fail explicitly; LMCanvas does not
  advertise the capabilities that would intentionally trigger them.
- A stale unloaded thread may be resumed and `turn/start` attempted once more.
  Failures after a turn has started are never automatically replayed because a
  retry could duplicate model output or tool side effects. A dead app-server is
  removed from the client cache so the next user action starts a fresh process.
- The installed-CLI smoke check performs initialize, model discovery, and an
  ephemeral thread start without spending model tokens. Runtime diagnostics
  expose the Codex user-agent and protocol version in advanced settings.
- Closing the last LMCanvas window quits the app on every platform. Quit cleanup
  synchronously terminates every live Codex app-server child, so neither the app
  nor its harness remains hidden after the user closes it.

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
- Claude's final assistant message ends the visible generating state immediately;
  the SDK result may arrive later and is retained for usage and error metadata.
  Provider policy refusals are typed separately from authentication failures so
  the UI can show concise recovery guidance while preserving raw details.
- A Fable 5 policy refusal triggers one automatic retry with Opus 4.8. The retry
  is recorded on the persisted assistant message and disclosed in the node UI;
  other errors and explicitly configured non-Fable models do not trigger it.
- Automatic LLM-backed canvas and group title calls are removed from the
  interactive path. Deterministic local title/group heuristics avoid consuming a
  provider slot while a user-requested chat is running.
- Local console timing markers cover chat start, first provider event, first
  renderer paint, and completion. They contain IDs, provider, phase, and elapsed
  milliseconds, but no prompt or response content.

## 2026-07-21 — Codex thread reuse and runtime capabilities

- Multiple messages on one canvas node are multiple turns on the same native
  thread. A persisted current-node thread is resumed once after an app-server
  restart; only a newly created child branch forks its parent thread.
- Resume and fork requests exclude turn payloads because LMCanvas already stores
  its own rendered messages and only needs native continuity.
- The Codex app-server starts in the background with the app and caches
  `model/list`. New installations follow the CLI-advertised default model and
  reasoning effort; explicit user settings remain overrides.
- The UI's Fast setting maps to the model-advertised `priority` service tier.
  Standard remains the default because priority processing consumes credits at
  a higher rate.
- Turns are serialized per native thread. Transient server-overload responses
  retry with bounded exponential backoff and jitter; unrelated failures do not.
  Idle thread subscriptions are capped and least-recently-used threads resume on
  demand.
