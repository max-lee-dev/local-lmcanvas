const EVENT = "lmc:openSettings";

export function openSettings(): void {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onOpenSettings(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
