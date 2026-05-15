import { Handle, Position } from "@xyflow/react";

// xyflow needs handle anchors to connect edges to. We don't want them visible,
// so they're rendered with opacity-0 + pointer-events-none. One per side, for
// both source and target, lets edges attach from any direction.

const HANDLE_CLASS = "!opacity-0 !pointer-events-none";

export function NodeTargetHandles() {
  return (
    <>
      <Handle isConnectable={false} type="target" position={Position.Top} id="target-top" className={HANDLE_CLASS} />
      <Handle isConnectable={false} type="target" position={Position.Right} id="target-right" className={HANDLE_CLASS} />
      <Handle isConnectable={false} type="target" position={Position.Bottom} id="target-bottom" className={HANDLE_CLASS} />
      <Handle isConnectable={false} type="target" position={Position.Left} id="target-left" className={HANDLE_CLASS} />
    </>
  );
}

export function NodeSourceHandles() {
  return (
    <>
      <Handle isConnectable={false} type="source" position={Position.Top} id="source-top" className={HANDLE_CLASS} />
      <Handle isConnectable={false} type="source" position={Position.Right} id="source-right" className={HANDLE_CLASS} />
      <Handle isConnectable={false} type="source" position={Position.Bottom} id="source-bottom" className={HANDLE_CLASS} />
      <Handle isConnectable={false} type="source" position={Position.Left} id="source-left" className={HANDLE_CLASS} />
    </>
  );
}
