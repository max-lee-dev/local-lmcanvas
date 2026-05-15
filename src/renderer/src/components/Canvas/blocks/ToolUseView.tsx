import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import type { ToolUseBlock } from "@shared/types";
import { getToolIcon, getToolSummary } from "./toolMeta";

type Props = {
  block: ToolUseBlock;
  awaitingText?: boolean;
};

export function ToolUseView({ block, awaitingText = false }: Props) {
  if (block.name === "TodoWrite") {
    return <TodoWriteView block={block} />;
  }
  return <GenericToolView block={block} awaitingText={awaitingText} />;
}

function GenericToolView({
  block,
  awaitingText,
}: {
  block: ToolUseBlock;
  awaitingText: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(block.name);
  const summary = getToolSummary(block.name, block.input);
  const running = !block.result;
  const isError = block.result?.isError === true;
  const showLoader = running || awaitingText;

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
