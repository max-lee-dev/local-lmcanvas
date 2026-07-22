# Structure

The source layout follows the summary in `README.md` and `AGENTS.md`.

- `src/main/agents/codexAppServer.ts` owns the single long-lived Codex app-server
  transport, runtime model catalog, overload retry policy, thread subscription
  cap, and per-thread turn serialization. `src/main/agents/codex.ts` maps its
  thread, turn, item, and delta notifications into provider-neutral chat events.
- `src/main/claude/runner.ts` owns Claude Agent SDK sessions. Provider-native
  session references are persisted on canvas chat nodes in `src/shared/types.ts`.
- `src/renderer/src/hooks/useNodeChat.ts` batches provider deltas before updating
  canvas state. Claude's final assistant event ends the visible generating state;
  its later SDK result still supplies usage and terminal metadata. A typed model
  fallback event persists and renders transparent Fable-to-Opus retries. Group and
  canvas titles use deterministic local heuristics on the interactive path so
  metadata generation cannot compete with the requested chat.

Codex and Claude keep their native transcripts in their normal CLI data stores.
Canvas JSON stores only the provider and opaque session/thread ID needed to
continue a node or fork a child branch. Codex is prewarmed during app startup;
its installed CLI supplies model, reasoning-effort, and service-tier metadata.
