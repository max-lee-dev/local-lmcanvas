import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch, Trash2 } from "lucide-react";
import { makeBlankNode, useCanvasStore } from "@/hooks/useCanvasStore";
import { useNodeChat } from "@/hooks/useNodeChat";
import type { CanvasNode } from "@shared/types";
import { NodeResponse } from "./NodeResponse";
import { NodePromptInput } from "./NodePromptInput";

type CustomNodeData = CanvasNode["data"];

function CustomNodeImpl(props: NodeProps) {
  const { id, data, selected } = props;
  const nodeData = data as CustomNodeData;
  const { submit, stop, streaming } = useNodeChat(id);
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const getNode = useCanvasStore((s) => s.nodes[id]);
  const [selectionText, setSelectionText] = useState<string>("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const setPrefill = useCanvasStore((s) => s.setPrefill);
  const branch = useCallback(
    (prefill?: string) => {
      const parentPos = getNode?.position ?? { x: 0, y: 0 };
      const offsetY = (getNode?.data.chat.childIds.length ?? 0) * 40;
      const child = makeBlankNode(
        { x: parentPos.x + 480, y: parentPos.y + offsetY },
        id
      );
      if (prefill) setPrefill(child.id, prefill);
      addNode(child);
      connectEdge(id, child.id);
    },
    [id, getNode, addNode, connectEdge, setPrefill]
  );

  // track text selection within this node for "branch from selection"
  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel || !rootRef.current) {
        setSelectionText("");
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelectionText("");
        return;
      }
      if (
        sel.anchorNode &&
        rootRef.current.contains(sel.anchorNode) &&
        sel.focusNode &&
        rootRef.current.contains(sel.focusNode)
      ) {
        setSelectionText(text);
      } else {
        setSelectionText("");
      }
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, []);

  const handleDelete = useCallback(() => {
    if (confirm("delete this node?")) removeNode(id);
  }, [id, removeNode]);

  const messages = nodeData.chat.messages;
  const title =
    nodeData.title ||
    messages.find((m) => m.role === "user")?.content.slice(0, 48) ||
    "new node";

  return (
    <div
      ref={rootRef}
      className={`flex w-[420px] flex-col overflow-hidden rounded-lg border bg-white shadow-sm ${
        selected ? "border-blue-400 ring-2 ring-blue-200" : "border-zinc-200"
      }`}
      data-node-id={id}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-400" />
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5">
        <div className="truncate text-xs font-medium text-zinc-700">{title}</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => branch()}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-zinc-200"
            title="branch (⌘+B)"
          >
            <GitBranch size={12} />
          </button>
          <button
            onClick={handleDelete}
            className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-50"
            title="delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="nowheel max-h-[480px] overflow-y-auto border-b border-zinc-100 p-2">
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <NodeResponse key={m.id} message={m} />
            ))}
          </div>
        </div>
      )}

      {selectionText && (
        <div className="flex items-center justify-between border-b border-zinc-200 bg-blue-50 px-2 py-1 text-xs">
          <span className="truncate text-blue-700">“{selectionText.slice(0, 40)}…”</span>
          <button
            className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
            onClick={() => {
              branch(`Re: "${selectionText}"\n\n`);
              window.getSelection()?.removeAllRanges();
              setSelectionText("");
            }}
          >
            branch here
          </button>
        </div>
      )}

      <NodePromptInput
        nodeId={id}
        onSubmit={submit}
        onStop={stop}
        streaming={streaming}
        autoFocus={messages.length === 0}
      />

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-zinc-400" />
    </div>
  );
}

export const CustomNode = memo(CustomNodeImpl);
