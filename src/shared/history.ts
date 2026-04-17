import type { CanvasNode, Message, NodeId } from "./types";

export function getMessageHistoryForNode(
  nodeId: NodeId,
  nodesById: Record<NodeId, CanvasNode>
): Message[] {
  const chain: CanvasNode[] = [];
  const seen = new Set<NodeId>();
  let current: CanvasNode | undefined = nodesById[nodeId];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    const parentId: NodeId | undefined = current.data.chat.parentIds[0];
    current = parentId ? nodesById[parentId] : undefined;
  }
  return chain.flatMap((n) => n.data.chat.messages);
}
