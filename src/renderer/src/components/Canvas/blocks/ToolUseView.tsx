import { useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  Loader2,
  PlayCircle,
  Square,
} from "lucide-react";
import clsx from "clsx";
import type { ToolUseBlock } from "@shared/types";
import { getToolIcon, getToolSummary } from "./toolMeta";
import { useCanvasStore } from "@/hooks/useCanvasStore";

type Props = {
  block: ToolUseBlock;
  nodeId?: string;
  awaitingText?: boolean;
};

export function ToolUseView({ block, nodeId, awaitingText = false }: Props) {
  const cwd = useCanvasStore((s) =>
    nodeId ? s.getEffectiveCwd(nodeId) : undefined
  );
  if (block.name === "TodoWrite") {
    return <TodoWriteView block={block} />;
  }
  return (
    <GenericToolView
      block={block}
      cwd={cwd}
      nodeId={nodeId}
      awaitingText={awaitingText}
    />
  );
}

function GenericToolView({
  block,
  cwd,
  nodeId,
  awaitingText,
}: {
  block: ToolUseBlock;
  cwd?: string;
  nodeId?: string;
  awaitingText: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(block.name);
  const summary = getToolSummary(block.name, block.input);
  const running = !block.result;
  const isError = block.result?.isError === true;
  const showLoader = running || awaitingText;
  const persistentCommand = extractPersistentCommand(block);

  return (
    <div
      className={clsx(
        "my-1 nodrag overflow-hidden rounded-[8px] border",
        isError
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={clsx(
          "flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors cursor-pointer",
          isError ? "hover:bg-destructive/10" : "hover:bg-muted"
        )}
        aria-label={expanded ? "Collapse tool call" : "Expand tool call"}
      >
        <Icon
          size={11}
          className={clsx(
            "shrink-0",
            isError ? "text-destructive" : "text-muted-foreground"
          )}
        />
        <span
          className={clsx(
            "shrink-0 text-[10px] font-medium",
            isError ? "text-destructive" : "text-foreground"
          )}
        >
          {displayName(block.name)}
        </span>
        {summary && (
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
            {summary}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {persistentCommand && (
            <PersistentProcessButton
              command={persistentCommand}
              cwd={cwd}
              nodeId={nodeId}
              toolRunning={running}
            />
          )}
          {showLoader ? (
            <Loader2 size={11} className="animate-spin text-muted-foreground" />
          ) : isError ? (
            <span className="text-[9px] font-medium text-destructive">failed</span>
          ) : (
            <CheckCircle2 size={11} className="text-foreground" />
          )}
          <ChevronDown
            size={11}
            className={clsx(
              "text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>
      {expanded && (
        <div
          className={clsx(
            "border-t px-2 py-1.5",
            isError ? "border-destructive/30" : "border-border"
          )}
        >
          <SectionLabel>input</SectionLabel>
          <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-words rounded-[6px] bg-muted px-2 py-1 font-mono text-[9.5px] leading-snug text-foreground">
            {prettyJson(block.input)}
          </pre>
          {block.result && (
            <>
              <SectionLabel>{isError ? "error" : "result"}</SectionLabel>
              <pre
                className={clsx(
                  "mt-0.5 overflow-x-auto whitespace-pre-wrap break-words rounded-[6px] px-2 py-1 font-mono text-[9.5px] leading-snug",
                  isError ? "bg-destructive/5 text-destructive" : "bg-muted text-foreground"
                )}
              >
                {block.result.content}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type PersistentProcessState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "running"; id: string; pid: number; logPath: string }
  | { status: "error"; message: string };

const IDLE_PERSISTENT_PROCESS_STATE: PersistentProcessState = { status: "idle" };
const PERSISTENT_PROCESS_RESTART_DELAY_MS = 800;
const persistentProcessStates = new Map<string, PersistentProcessState>();
const persistentProcessListeners = new Set<() => void>();

function getPersistentProcessKey(command: string, cwd?: string): string {
  return `${cwd ?? ""}\n${command}`;
}

function subscribePersistentProcesses(listener: () => void): () => void {
  persistentProcessListeners.add(listener);
  return () => {
    persistentProcessListeners.delete(listener);
  };
}

function getPersistentProcessSnapshot(
  key: string
): PersistentProcessState {
  return persistentProcessStates.get(key) ?? IDLE_PERSISTENT_PROCESS_STATE;
}

function setPersistentProcessState(
  key: string,
  state: PersistentProcessState
): void {
  if (state.status === "idle") {
    persistentProcessStates.delete(key);
  } else {
    persistentProcessStates.set(key, state);
  }
  persistentProcessListeners.forEach((listener) => listener());
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function PersistentProcessButton({
  command,
  cwd,
  nodeId,
  toolRunning,
}: {
  command: string;
  cwd?: string;
  nodeId?: string;
  toolRunning: boolean;
}) {
  const key = getPersistentProcessKey(command, cwd);
  const state = useSyncExternalStore(
    subscribePersistentProcesses,
    () => getPersistentProcessSnapshot(key),
    () => getPersistentProcessSnapshot(key)
  );

  const start = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPersistentProcessState(key, { status: "starting" });
    try {
      if (toolRunning && nodeId) {
        await window.api.chat.cancelForNode(nodeId);
        await wait(PERSISTENT_PROCESS_RESTART_DELAY_MS);
      }
      const result = await window.api.processes.start({ command, cwd });
      setPersistentProcessState(key, { status: "running", ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPersistentProcessState(key, { status: "error", message });
    }
  };

  const stop = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.status !== "running") return;
    const result = await window.api.processes.stop(state.id);
    if (result.stopped) {
      setPersistentProcessState(key, { status: "idle" });
    } else {
      setPersistentProcessState(key, {
        status: "error",
        message: result.message ?? "Failed to stop process.",
      });
    }
  };

  if (state.status === "running") {
    return (
      <>
        <button
          type="button"
          title={`Open process log: ${state.logPath}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void window.api.shell.openPath(state.logPath);
          }}
          className="inline-flex h-5 items-center gap-1 rounded-md border border-border bg-background px-1.5 text-[9px] font-medium text-muted-foreground hover:text-foreground"
        >
          <FileText size={10} />
          {state.pid}
        </button>
        <button
          type="button"
          title="Stop detached process"
          onClick={stop}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
        >
          <Square size={9} />
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      title={
        state.status === "error"
          ? state.message
          : toolRunning
            ? "Stop the node and restart this command as a detached process"
            : "Keep this command running after the node completes"
      }
      onClick={start}
      disabled={state.status === "starting"}
      className={clsx(
        "inline-flex h-5 items-center gap-1 rounded-md border border-border bg-background px-1.5 text-[9px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60",
        state.status === "error" && "border-destructive/40 text-destructive"
      )}
    >
      {state.status === "starting" ? (
        <Loader2 size={10} className="animate-spin" />
      ) : (
        <PlayCircle size={10} />
      )}
      Keep running
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 text-[8px] font-medium uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </div>
  );
}

function TodoWriteView({ block }: { block: ToolUseBlock }) {
  const todos = extractTodos(block.input);
  const running = !block.result;
  const isError = block.result?.isError === true;
  const done = todos.filter((t) => t.status === "completed").length;

  return (
    <div
      className={clsx(
        "my-1 nodrag rounded-[8px] border px-2.5 py-1.5",
        isError ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>todos</span>
        {running && <Loader2 size={10} className="animate-spin text-muted-foreground" />}
        <span className="ml-auto font-mono text-muted-foreground">
          {done}/{todos.length}
        </span>
      </div>
      {todos.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">(no todos)</div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {todos.map((t, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px]">
              <TodoIcon status={t.status} />
              <span
                className={clsx(
                  "min-w-0 flex-1 break-words",
                  t.status === "completed" && "text-muted-foreground line-through",
                  t.status === "in_progress" && "font-medium text-foreground",
                  t.status === "pending" && "text-foreground"
                )}
              >
                {t.status === "in_progress" && t.activeForm ? t.activeForm : t.content}
              </span>
            </li>
          ))}
        </ul>
      )}
      {isError && block.result?.content && (
        <div className="mt-1 flex items-start gap-1 text-[10px] text-destructive">
          <AlertCircle size={10} className="mt-0.5 shrink-0" />
          <span className="break-words">{block.result.content}</span>
        </div>
      )}
    </div>
  );
}

function TodoIcon({ status }: { status: TodoStatus }) {
  if (status === "completed") {
    return <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-foreground" />;
  }
  if (status === "in_progress") {
    return <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin text-muted-foreground" />;
  }
  return <Circle size={12} className="mt-0.5 shrink-0 text-border" />;
}

type TodoStatus = "pending" | "in_progress" | "completed";
type Todo = { content: string; status: TodoStatus; activeForm?: string };

function extractTodos(input: unknown): Todo[] {
  if (typeof input !== "object" || input === null) return [];
  const todos = (input as Record<string, unknown>).todos;
  if (!Array.isArray(todos)) return [];
  const out: Todo[] = [];
  for (const t of todos) {
    if (typeof t !== "object" || t === null) continue;
    const obj = t as Record<string, unknown>;
    const content = typeof obj.content === "string" ? obj.content : "";
    const rawStatus = typeof obj.status === "string" ? obj.status : "pending";
    const status: TodoStatus =
      rawStatus === "completed" || rawStatus === "in_progress" ? rawStatus : "pending";
    const activeForm = typeof obj.activeForm === "string" ? obj.activeForm : undefined;
    out.push({ content, status, activeForm });
  }
  return out;
}

function displayName(name: string): string {
  if (name.startsWith("mcp__")) {
    const rest = name.slice(5);
    const parts = rest.split("__");
    return parts.length > 1 ? `mcp:${parts[parts.length - 1]}` : `mcp:${rest}`;
  }
  return name;
}

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function extractPersistentCommand(block: ToolUseBlock): string | null {
  if (!isCommandTool(block.name) || !isRecord(block.input)) return null;
  const rawCommand = block.input["command"];
  const command = Array.isArray(rawCommand)
    ? rawCommand.filter((part): part is string => typeof part === "string").join(" ")
    : typeof rawCommand === "string"
      ? rawCommand
      : null;
  if (!command || !looksLongRunning(command)) return null;
  return command;
}

function isCommandTool(name: string): boolean {
  return name === "Bash" || name === "exec" || name === "command_execution";
}

function looksLongRunning(command: string): boolean {
  const normalized = command.toLowerCase();
  return [
    /\b(bun|npm|pnpm|yarn)\s+(run\s+)?(dev|start|serve|preview|watch)\b/,
    /\b(vite|next|astro|svelte-kit|webpack-dev-server|nodemon)\b/,
    /\bturbo\s+(run\s+)?dev\b/,
    /\btsx\s+watch\b/,
    /\bpython3?\s+-m\s+http\.server\b/,
    /\buvicorn\b/,
  ].some((pattern) => pattern.test(normalized));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
