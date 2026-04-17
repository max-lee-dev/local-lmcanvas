# local-lmcanvas — Implementation Plan

## What This Is

A **fully local, canvas-based branching AI conversation tool** that uses the **Claude Code CLI** as its LLM backend instead of API calls. Think: take the best parts of Avera (the canvas, the branching, the node-based conversation graph) and strip it down to run entirely on the user's machine with no cloud dependencies, no API keys, no auth, no database — just local files and the Claude Code subprocess.

**Reference codebase:** `/Users/maxlee/Developer/gitgud2/avera` — read from it freely for UI patterns, component structure, store logic, types. But do NOT copy its cloud plumbing (Supabase, auth, billing, analytics, Vercel AI SDK routing, OpenRouter, Helicone, PostHog, Stripe, rate limiting).

**Build location:** `/Users/maxlee/Developer/gitgud2/local-lmcanvas/`

---

## The Core Idea

Each conversation is a **tree of message nodes** on a **canvas**. You can:

1. Start a conversation (root node = a prompt, response streams in)
2. **Branch** from any node — forks the conversation history up to that point and starts a new line
3. **Branch from highlighted text** — select a phrase in a response, right-click, spawn a child node with that context
4. Navigate the graph visually — zoom, pan, drag nodes around, see the whole "shape" of your thinking
5. Everything persists to local files so you can close the app and come back

Instead of calling `api.anthropic.com`, **each AI turn spawns a `claude` CLI subprocess**, pipes the conversation history in, and streams the response back into the node. Free (uses your existing Claude Code subscription/plan). Fully offline-capable (well, except Claude itself needs internet — but no Avera-side servers are involved).

---

## Tech Stack

**Frontend:**
- **Next.js 15** (App Router, React 19, TypeScript) — same as Avera so patterns translate
- **ReactFlow (xyflow/react v12)** — canvas rendering, nodes, edges
- **Zustand** — client state (graph store)
- **Tailwind CSS v4** — styling (minimal, no fancy theming to start)
- **Radix UI + Lucide icons** — basic UI primitives
- **react-markdown + remark-gfm + rehype-highlight** — response rendering
- **framer-motion** — optional, for subtle node animations

**Backend (local Next.js API routes):**
- **Node `child_process.spawn`** — spawns `claude` CLI
- **Server-Sent Events (SSE)** — stream CLI stdout back to browser
- **Better-SQLite3** OR **plain JSON files** — local persistence (start with JSON, migrate to SQLite if needed)

**Local storage path:** `~/.local-lmcanvas/` (create on first run)
- `~/.local-lmcanvas/canvases/<canvas-id>.json` — each canvas = one JSON file
- `~/.local-lmcanvas/settings.json` — app-wide settings

**No auth. No cloud. No billing. No telemetry.**

---

## Critical Architectural Decision: How to Call Claude Code

There are three viable approaches. **Pick option A** for the first build.

### Option A: Claude Code CLI via `claude -p` (RECOMMENDED — START HERE)

The `claude` CLI supports a non-interactive "print" mode:

```bash
claude -p "your prompt here" --output-format stream-json
```

- `--output-format stream-json` → emits JSONL events (message_start, content_block_delta, message_stop) we can parse line-by-line
- `--output-format json` → single JSON blob at the end
- `--output-format text` → plain text

To continue a conversation with history, the simplest approach: **build a single combined prompt containing the full history** and pass as `-p`. Claude Code is stateless in `-p` mode per invocation.

Example stream parsing:
```ts
import { spawn } from "node:child_process";
const proc = spawn("claude", ["-p", combinedPrompt, "--output-format", "stream-json"]);
proc.stdout.on("data", (chunk) => {
  // parse JSONL, forward to SSE
});
```

**Pros:** Simple, no dependencies, works today.
**Cons:** Each turn re-sends full history to CLI. Not an issue for normal use.

### Option B: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

Typed programmatic API instead of shelling out. Better for production, but adds a dep and setup.

### Option C: Persistent session reuse via `claude --resume`

Claude Code supports session resumption. Could spawn once, resume per turn. More complex — skip for v1.

**→ Build with Option A. Leave a clean abstraction (`lib/claude/runner.ts`) so swapping to B or C later is a one-file change.**

---

## Folder Structure

```
local-lmcanvas/
├── plan.md                           # THIS FILE
├── README.md                         # quick-start instructions
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .gitignore                        # ignore .next, node_modules, ~/.local-lmcanvas backups
├── app/
│   ├── layout.tsx                    # root layout
│   ├── page.tsx                      # canvas list / picker
│   ├── canvas/
│   │   └── [id]/
│   │       └── page.tsx              # main canvas view
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts              # POST → spawns claude, streams SSE
│   │   ├── canvases/
│   │   │   ├── route.ts              # GET list, POST create
│   │   │   └── [id]/
│   │   │       └── route.ts          # GET/PUT/DELETE one canvas
│   │   └── settings/
│   │       └── route.ts              # GET/PUT settings
│   └── globals.css
├── components/
│   ├── Canvas/
│   │   ├── Canvas.tsx                # main ReactFlow wrapper
│   │   ├── CustomNode.tsx            # conversation node
│   │   ├── CustomNode.module.css     # (optional scoped styles)
│   │   ├── NodeHeader.tsx            # title / model / actions
│   │   ├── NodePromptInput.tsx       # input textarea + submit
│   │   ├── NodeResponse.tsx          # markdown-rendered response
│   │   ├── NodeFooter.tsx            # branch / delete buttons
│   │   ├── ContextMenu.tsx           # right-click menu
│   │   └── SelectionBranchMenu.tsx   # text-selection → branch popover
│   ├── Sidebar/
│   │   ├── CanvasList.tsx            # list of saved canvases
│   │   └── Sidebar.tsx
│   └── ui/                           # small shared primitives (Button, etc.)
├── lib/
│   ├── claude/
│   │   ├── runner.ts                 # spawn claude, return async iterable of deltas
│   │   ├── parser.ts                 # parse stream-json events
│   │   └── history.ts                # build prompt-with-history string
│   ├── storage/
│   │   ├── paths.ts                  # resolves ~/.local-lmcanvas/ paths
│   │   ├── canvases.ts               # read/write canvas JSON files
│   │   └── settings.ts               # read/write settings
│   ├── graph/
│   │   ├── operations.ts             # addNode, connectEdge, deleteNode, branch, etc.
│   │   ├── history.ts                # walk parentIds up to root → message history
│   │   └── types.ts                  # Node, Edge, Message, ChatData
│   └── sse/
│       └── client.ts                 # EventSource wrapper for streaming
├── hooks/
│   ├── useCanvasStore.ts             # Zustand store (single source of truth)
│   ├── useNodeChat.ts                # per-node: submit, stream, finalize
│   └── useKeyboardShortcuts.ts
└── types/
    └── index.ts                      # shared types re-exported
```

---

## Data Model

### Node

```ts
type NodeId = string; // nanoid

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;          // plain text for user; markdown for assistant
  createdAt: number;        // Date.now()
  status?: "streaming" | "complete" | "error";
  error?: string;
};

type ChatData = {
  messages: Message[];      // turns in THIS node only (not inherited)
  parentIds: NodeId[];      // usually 0 or 1; allow multiple for merge later
  childIds: NodeId[];
  // parentMessageIds: optional future optimization; skip for v1
};

type CanvasNodeType = "custom" | "stickyNote";

type CanvasNode = {
  id: NodeId;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: {
    title?: string;              // optional, auto-derived from first user message
    chat: ChatData;
    stickyText?: string;         // only for stickyNote type
  };
};

type CanvasEdge = {
  id: string;
  source: NodeId;
  target: NodeId;
};

type Canvas = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};
```

### Conversation History Reconstruction

When calling Claude for node X, **walk up `parentIds` to the root**, collecting each ancestor's `messages` in order, then append X's own `messages`. Pass that as the history to Claude.

```ts
// lib/graph/history.ts
export function getMessageHistoryForNode(
  nodeId: NodeId,
  nodesById: Record<NodeId, CanvasNode>
): Message[] {
  const chain: CanvasNode[] = [];
  let current: CanvasNode | undefined = nodesById[nodeId];
  while (current) {
    chain.unshift(current);
    const parentId = current.data.chat.parentIds[0];
    current = parentId ? nodesById[parentId] : undefined;
  }
  return chain.flatMap((n) => n.data.chat.messages);
}
```

---

## API Routes

### `POST /api/chat`

**Request body:**
```ts
{
  canvasId: string;
  nodeId: string;
  history: Message[];      // full prior history (client builds via getMessageHistoryForNode)
  prompt: string;          // the new user message
  systemPrompt?: string;   // optional
}
```

**Response:** Server-Sent Events stream. Event types:
- `data: {"type":"start","messageId":"..."}`
- `data: {"type":"delta","text":"chunk..."}`
- `data: {"type":"done","fullText":"..."}`
- `data: {"type":"error","message":"..."}`

**Implementation outline:**
```ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const combinedPrompt = buildPromptWithHistory(body.history, body.prompt, body.systemPrompt);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        send({ type: "start", messageId: nanoid() });
        for await (const delta of runClaude(combinedPrompt)) {
          send({ type: "delta", text: delta });
        }
        send({ type: "done" });
      } catch (err: any) {
        send({ type: "error", message: err.message ?? "unknown" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
```

### `GET/POST /api/canvases`
- `GET` → list all canvases (metadata only: id, name, createdAt, updatedAt)
- `POST` → create new blank canvas, return `{id}`

### `GET/PUT/DELETE /api/canvases/[id]`
- `GET` → return full canvas JSON
- `PUT` → overwrite canvas JSON (body = full Canvas object)
- `DELETE` → delete canvas file

### `GET/PUT /api/settings`
- Settings shape: `{ systemPrompt?: string; claudeModel?: string; claudeBinPath?: string }`
- Defaults: systemPrompt = "", claudeModel = undefined (let Claude Code pick), claudeBinPath = "claude"

---

## The Claude Runner (`lib/claude/runner.ts`)

```ts
import { spawn } from "node:child_process";

export async function* runClaude(
  prompt: string,
  opts: { claudeBin?: string; model?: string; systemPrompt?: string } = {}
): AsyncGenerator<string, void, void> {
  const bin = opts.claudeBin ?? "claude";
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];
  if (opts.model) args.push("--model", opts.model);
  if (opts.systemPrompt) args.push("--append-system-prompt", opts.systemPrompt);

  const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

  let buffer = "";
  let stderr = "";

  proc.stderr.on("data", (d) => (stderr += d.toString()));

  for await (const chunk of proc.stdout) {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        // stream-json events: assistant messages contain content blocks with text deltas
        // Shape varies; inspect with `claude -p "hi" --output-format stream-json --verbose`
        const text = extractTextFromEvent(ev);
        if (text) yield text;
      } catch {
        // ignore malformed lines
      }
    }
  }

  const exitCode: number = await new Promise((res) => proc.on("close", res));
  if (exitCode !== 0) {
    throw new Error(`claude exited ${exitCode}: ${stderr.slice(0, 500)}`);
  }
}

function extractTextFromEvent(ev: any): string | null {
  // Known stream-json shapes (verify empirically on first run):
  // - { type: "assistant", message: { content: [{ type: "text", text: "..." }] } }
  // - { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "..." } } }
  // - { type: "result", ... } (final)
  if (ev.type === "assistant" && ev.message?.content) {
    const parts = ev.message.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text);
    return parts.join("") || null;
  }
  if (ev.type === "stream_event" && ev.event?.type === "content_block_delta") {
    return ev.event.delta?.text ?? null;
  }
  return null;
}
```

**⚠️ CRITICAL:** On first run, verify the actual event shapes by running:
```bash
claude -p "say hi" --output-format stream-json --verbose
```
…and adjust `extractTextFromEvent` to match. The shape may have evolved.

---

## Building the Prompt with History (`lib/claude/history.ts`)

For v1, flatten the history into a single text prompt. It's not pretty but it works:

```ts
export function buildPromptWithHistory(
  history: Message[],
  newUserPrompt: string,
  systemPrompt?: string
): string {
  const sections: string[] = [];
  if (systemPrompt) sections.push(`[System]\n${systemPrompt}`);
  for (const m of history) {
    const role = m.role === "user" ? "User" : "Assistant";
    sections.push(`[${role}]\n${m.content}`);
  }
  sections.push(`[User]\n${newUserPrompt}`);
  sections.push(`[Assistant]`);
  return sections.join("\n\n");
}
```

**Alternative (better):** Use `--append-system-prompt` for the system bit and pass only the most recent user turn with conversation context included as context.

**Alternative (best, but later):** Move to `@anthropic-ai/claude-agent-sdk` which accepts structured messages natively.

---

## Canvas Store (`hooks/useCanvasStore.ts`)

Zustand store, one instance per canvas page:

```ts
type CanvasStore = {
  canvasId: string | null;
  name: string;
  nodes: Record<NodeId, CanvasNode>;
  edges: CanvasEdge[];

  // mutations
  loadCanvas: (id: string) => Promise<void>;
  saveCanvas: () => Promise<void>;          // debounced
  addNode: (node: CanvasNode) => void;
  patchNode: (id: NodeId, patch: Partial<CanvasNode>) => void;
  removeNode: (id: NodeId) => void;
  connectEdge: (source: NodeId, target: NodeId) => void;
  appendMessage: (nodeId: NodeId, msg: Message) => void;
  appendDeltaToMessage: (nodeId: NodeId, messageId: string, delta: string) => void;
  finalizeMessage: (nodeId: NodeId, messageId: string) => void;

  // derived
  getHistoryForNode: (id: NodeId) => Message[];
};
```

**Persistence:** After any mutation, schedule a debounced save (1-2s) via `PUT /api/canvases/[id]`. Also flush on `beforeunload`.

---

## useNodeChat Hook

Handles submitting a prompt and streaming the response into a node's latest assistant message.

```ts
export function useNodeChat(nodeId: NodeId) {
  const store = useCanvasStore();

  const submit = useCallback(async (promptText: string) => {
    const userMsgId = nanoid();
    store.appendMessage(nodeId, { id: userMsgId, role: "user", content: promptText, createdAt: Date.now(), status: "complete" });

    const asstMsgId = nanoid();
    store.appendMessage(nodeId, { id: asstMsgId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming" });

    const history = store.getHistoryForNode(nodeId).slice(0, -2); // exclude the two we just added

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        canvasId: store.canvasId,
        nodeId,
        history,
        prompt: promptText,
      }),
    });
    if (!res.body) throw new Error("no body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = JSON.parse(line.slice(5).trim());
        if (payload.type === "delta") {
          store.appendDeltaToMessage(nodeId, asstMsgId, payload.text);
        } else if (payload.type === "done") {
          store.finalizeMessage(nodeId, asstMsgId);
        } else if (payload.type === "error") {
          // mark message as error
        }
      }
    }
  }, [nodeId, store]);

  return { submit };
}
```

---

## Branching

Two entry points:

### 1. "Branch from node" (button on node footer or right-click menu)

```ts
function branchFromNode(parentId: NodeId) {
  const parent = store.nodes[parentId];
  const newId = nanoid();
  const newNode: CanvasNode = {
    id: newId,
    type: "custom",
    position: { x: parent.position.x + 400, y: parent.position.y + 100 },
    data: {
      chat: { messages: [], parentIds: [parentId], childIds: [] },
    },
  };
  store.addNode(newNode);
  store.connectEdge(parentId, newId);
  // parent's childIds gets updated in connectEdge
}
```

History reconstruction will automatically pull in the parent's messages when calling Claude.

### 2. "Branch from selection" (right-click highlighted text in assistant response)

- On mouseup inside a response, if `window.getSelection()` has text, show a small floating "Branch here" button.
- Clicking it → branch from the current node, then pre-fill the new node's input with a quoted snippet:
  ```
  Re: "{selected text}"

  ```

---

## UI / Visual Direction

Minimal. Function first.

- **Canvas background:** soft dot grid
- **Nodes:** rounded-lg, white/dark card, subtle shadow, ~400px wide, variable height
  - Header: small title (derived from first user message, truncated), "⋯" menu button
  - Response area: markdown-rendered, scrollable if > 400px tall, fades at bottom when clipped
  - Prompt input: auto-resizing textarea at bottom, Cmd+Enter to submit
  - Footer: tiny "↳ branch" button, "🗑 delete" button
- **Edges:** smooth bezier curves, no labels
- **Top-left:** current canvas name (editable on click), link to canvas list
- **Top-right:** settings cog (opens modal: system prompt, claude bin path)
- **Keyboard:**
  - `Cmd+Enter` inside a prompt input → submit
  - `Cmd+B` on focused node → branch
  - `Delete/Backspace` on focused node → delete (with confirm)
  - `Cmd+K` → command palette (later)

Color / theme: **light mode only for v1**. Dark mode later.

---

## Build Order (Do It In This Sequence)

**Phase 1 — Skeleton (~30 min)**
1. `npm create next-app@latest local-lmcanvas --ts --tailwind --app --no-src-dir --no-eslint --import-alias "@/*"` inside `/Users/maxlee/Developer/gitgud2/`
2. `npm install @xyflow/react zustand nanoid react-markdown remark-gfm rehype-highlight lucide-react clsx`
3. `npm install -D @types/node`
4. Drop in the folder structure above (empty files are fine).
5. Verify `npm run dev` starts on port 3000.

**Phase 2 — Storage layer (~45 min)**
1. Implement `lib/storage/paths.ts`, `lib/storage/canvases.ts`, `lib/storage/settings.ts` with `fs/promises`.
2. Auto-create `~/.local-lmcanvas/canvases/` on first access.
3. Implement `/api/canvases` and `/api/canvases/[id]` routes.
4. Test with `curl`:
   ```bash
   curl -X POST localhost:3000/api/canvases -d '{"name":"Test"}' -H "content-type: application/json"
   curl localhost:3000/api/canvases
   ```

**Phase 3 — Claude runner + chat route (~1 hr)**
1. Implement `lib/claude/runner.ts` and `lib/claude/history.ts`.
2. **CRITICAL:** Before coding `extractTextFromEvent`, run `claude -p "hi" --output-format stream-json --verbose` in a terminal and inspect the actual event shapes. Adjust parser to match.
3. Implement `/api/chat` route with SSE streaming.
4. Test with `curl`:
   ```bash
   curl -N -X POST localhost:3000/api/chat \
     -H "content-type: application/json" \
     -d '{"canvasId":"test","nodeId":"n1","history":[],"prompt":"say hi in 3 words"}'
   ```
   Should stream chunks.

**Phase 4 — Canvas page + store (~1.5 hr)**
1. Build `hooks/useCanvasStore.ts` (Zustand).
2. Build `app/canvas/[id]/page.tsx` that loads canvas by id on mount, wires up ReactFlow.
3. Build `components/Canvas/Canvas.tsx` with ReactFlow, custom node types registered.
4. Build `components/Canvas/CustomNode.tsx` with response + input + footer.
5. Wire `useNodeChat` to submit → stream → update store.
6. Debounced save on any mutation.

**Phase 5 — Branching (~45 min)**
1. Add "Branch" button to node footer.
2. On click → call `branchFromNode(parentId)` which creates node + edge, auto-focuses new node's input.
3. Verify history walks correctly by branching a 3-deep conversation.

**Phase 6 — Canvas list page (~30 min)**
1. `app/page.tsx` = list of canvases with "New canvas" button + click to open.
2. Rename inline, delete with confirm.

**Phase 7 — Polish (~1 hr)**
1. Keyboard shortcuts.
2. Text-selection branching (SelectionBranchMenu).
3. Settings modal.
4. Error states (what if `claude` binary isn't found? Show helpful message.)
5. Loading states.
6. Empty canvas state: show a centered "Start by double-clicking anywhere on the canvas".
7. Double-click on empty canvas → create new root node at that position.

**Phase 8 — Test & README (~30 min)**
1. Create a canvas, have a 5-turn conversation, branch 3 times, reload page, verify everything persists.
2. Write `README.md` with: what it is, prerequisites (Claude Code installed + authenticated), how to run (`npm run dev`), storage location.

**Total estimated time: ~6 hours of focused work.**

---

## Things to Intentionally NOT Build in v1

Don't waste time on these. Add them later if they're missed:

- ❌ Auth / users / multi-user
- ❌ Cloud sync / Supabase / any database
- ❌ Multi-model support (Council mode) — Claude only
- ❌ BYOK / API keys — uses whatever Claude Code is logged into
- ❌ Image attachments / PDFs
- ❌ RAG / web search integration
- ❌ Imports from ChatGPT/Claude/Gemini
- ❌ Group summaries
- ❌ Personas / personalities
- ❌ Projects (grouping canvases)
- ❌ Merge operation (combining two branches)
- ❌ Sticky notes (nice-to-have, can add in phase 7 if time)
- ❌ Onboarding nudges
- ❌ Dark mode
- ❌ Mobile responsive
- ❌ Telemetry
- ❌ Billing
- ❌ Rate limiting
- ❌ Helicone / PostHog

---

## Key Things to Get Right

1. **Streaming feels good.** Deltas should appear in the node as Claude types. If this lags, the product feels broken. Use SSE (not polling), render deltas directly via Zustand (don't batch > 50ms).

2. **Persistence is robust.** Debounced save on any graph change, also save on `beforeunload`. If Claude crashes mid-stream, the partial response should still persist on reload.

3. **Branching is one click.** Don't make the user navigate a menu. A "↳" button on the node, or a hotkey.

4. **Error messages are useful.** If `claude` binary isn't found, say so plainly with instructions. If Claude returns an error (rate limit, auth), show it in-node.

5. **The history walk is correct.** Write a unit test for `getMessageHistoryForNode` with a 4-deep tree. Verify it includes every ancestor in order.

6. **ReactFlow gotchas:**
   - Use `@xyflow/react` (v12), not the deprecated `reactflow` (v11) package. Avera uses v11; DO NOT copy its imports blindly.
   - Register node types OUTSIDE the component render (`const nodeTypes = { custom: CustomNode }`) to avoid re-registration warnings.
   - Use `useNodesState` and `useEdgesState` for ReactFlow's own state, mirror to Zustand for persistence.

7. **SSE on Next.js App Router:** Make sure the route handler sets `export const runtime = "nodejs"` (not edge), and that headers include `Cache-Control: no-cache, no-transform`.

---

## Sanity Checks After Building

- [ ] Can create a new canvas from the home page.
- [ ] Canvas opens to an empty grid.
- [ ] Double-click empty space creates a new root node.
- [ ] Typing a prompt and hitting Cmd+Enter streams a response into the node.
- [ ] Branch button on a node creates a child node wired by an edge.
- [ ] Typing in the child node includes the parent's conversation as context (verify by asking "what did I just ask you?" in the child).
- [ ] Refreshing the page restores the full canvas including in-progress streams (in-progress → mark as error or drop last assistant msg).
- [ ] Deleting a node removes it and its incoming/outgoing edges.
- [ ] Canvas list page shows all canvases, rename works, delete works.
- [ ] If `claude` binary isn't in PATH, you get a helpful error, not a cryptic one.
- [ ] `~/.local-lmcanvas/canvases/*.json` files look sane and human-readable.

---

## When You Start, First Do This

1. Verify Claude Code is installed and working:
   ```bash
   which claude
   claude -p "say hi" --output-format stream-json --verbose | head -30
   ```
   Copy the event shapes you see — they'll guide `extractTextFromEvent`.

2. Read these Avera files for reference (don't copy — translate to v12 xyflow + no Supabase):
   - `app/features/canvas/components/Canvas/Canvas.tsx` — overall structure
   - `app/features/canvas/components/CustomNode/CustomNode.tsx` — node anatomy
   - `app/features/canvas/store/graph.slice.ts` — store patterns
   - `app/features/canvas/hooks/useNodeChatState.ts` — how it handles streaming

3. Scaffold the Next.js app.

4. Build Phase 1 → 8 in order. Don't jump ahead — each phase builds on the last.

5. Commit after each phase with a clear message.

---

## Success Criteria

You're done when: **Max can open the app, create a canvas, have a branching conversation with Claude across several nodes, close the browser, come back the next day, and everything is still there — all without touching a cloud service.**

Good luck. Build it. 🚀
