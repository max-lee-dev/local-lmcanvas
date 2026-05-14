import type { WheelEvent } from "react";

export function forwardWheelAtBoundary(e: WheelEvent<HTMLElement>): void {
  const el = e.currentTarget;
  const isScrollable = el.scrollHeight > el.clientHeight;
  if (!isScrollable) return;

  const atTop = el.scrollTop <= 0;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

  const goingUp = e.deltaY < 0;
  const goingDown = e.deltaY > 0;

  if ((goingUp && !atTop) || (goingDown && !atBottom)) {
    e.stopPropagation();
  }
}
