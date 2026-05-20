// Shared layout constants for canvas nodes. Single source of truth so the
// collision resolver, camera centering, branch buttons, and context-menu
// child placement all agree on geometry.

export const NODE_WIDTH = 450;
export const NODE_MAX_WIDTH = 1100;
export const NODE_MIN_HEIGHT = 96;

// Avera-style padding multiplier: the right-lane child sits NODE_WIDTH +
// HORIZONTAL_PADDING * RIGHT_LANE_GAP_MULTIPLIER to the right of its parent.
// Avera uses HORIZONTAL_PADDING = 50 and multiplier 2 → 100px gap. We mirror it.
export const HORIZONTAL_PADDING = 50;
export const RIGHT_LANE_GAP_MULTIPLIER = 2;
export const RIGHT_LANE_X_OFFSET =
  NODE_WIDTH + HORIZONTAL_PADDING * RIGHT_LANE_GAP_MULTIPLIER;

export const VERTICAL_CHILD_OFFSET = 150;

// Fallback height used when a node has not yet been measured in the DOM
// (e.g. immediately after creation). Avera uses 250-ish here. We pick 300 to
// match the existing CustomNode fallback.
export const FALLBACK_NODE_HEIGHT = 300;

// Camera defaults
export const FOCUS_ZOOM = 1.5;
export const FOCUS_DURATION_MS = 800;

// Collision resolver
export const COLLISION_PADDING_PX = 50;
export const MAX_CASCADE_ITERATIONS_MIN = 40;
