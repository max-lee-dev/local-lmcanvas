import {
  Terminal,
  FilePen,
  Pencil,
  FileText,
  Search,
  Folder,
  ListTodo,
  Sparkles,
  Globe,
  NotebookPen,
  Network,
  Plug,
  Wrench,
  PlayCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export function getToolIcon(name: string): LucideIcon {
  if (name.startsWith("mcp__")) return Plug;
  switch (name) {
    case "Bash":
      return Terminal;
    case "BashOutput":
      return PlayCircle;
    case "KillBash":
      return XCircle;
    case "Edit":
    case "MultiEdit":
      return Pencil;
    case "Write":
      return FilePen;
    case "Read":
      return FileText;
    case "Grep":
      return Search;
    case "Glob":
      return Folder;
    case "TodoWrite":
      return ListTodo;
    case "Task":
      return Sparkles;
    case "WebFetch":
    case "WebSearch":
      return Globe;
    case "NotebookEdit":
    case "NotebookRead":
      return NotebookPen;
    case "ExitPlanMode":
      return Network;
    default:
      return Wrench;
  }
}

export function getToolSummary(name: string, input: unknown): string {
  const obj = isRecord(input) ? input : {};

  if (name.startsWith("mcp__")) {
    const short = name.slice(5);
    const first = firstStringValue(obj);
    return first ? `${short} · ${truncate(first, 80)}` : short;
  }

  switch (name) {
    case "Bash":
      return truncate(stringField(obj, "command") ?? "", 120);
    case "BashOutput":
      return stringField(obj, "bash_id") ?? "";
    case "KillBash":
      return stringField(obj, "shell_id") ?? "";
    case "Edit":
    case "Write":
    case "Read":
    case "MultiEdit":
      return truncate(stringField(obj, "file_path") ?? "", 120);
    case "Grep": {
      const pattern = stringField(obj, "pattern") ?? "";
      const path = stringField(obj, "path");
      return path ? `${truncate(pattern, 60)} · ${truncate(path, 40)}` : truncate(pattern, 100);
    }
    case "Glob":
      return truncate(stringField(obj, "pattern") ?? "", 120);
    case "TodoWrite": {
      const todos = obj["todos"];
      if (Array.isArray(todos)) {
        const done = todos.filter(
          (t) => isRecord(t) && t["status"] === "completed"
        ).length;
        return `${done}/${todos.length} done`;
      }
      return "";
    }
    case "Task":
      return truncate(
        stringField(obj, "description") ?? stringField(obj, "subagent_type") ?? "",
        120
      );
    case "WebFetch":
      return truncate(stringField(obj, "url") ?? "", 120);
    case "WebSearch":
      return truncate(stringField(obj, "query") ?? "", 120);
    case "NotebookEdit":
    case "NotebookRead":
      return truncate(stringField(obj, "notebook_path") ?? "", 120);
    case "ExitPlanMode":
      return truncate(stringField(obj, "plan") ?? "", 120);
    default: {
      const first = firstStringValue(obj);
      if (first) return truncate(first, 120);
      try {
        return truncate(JSON.stringify(input ?? {}), 120);
      } catch {
        return "";
      }
    }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function firstStringValue(obj: Record<string, unknown>): string | undefined {
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
