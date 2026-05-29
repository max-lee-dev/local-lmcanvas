import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, RotateCw, X } from "lucide-react";
import { useBrowserPanelStore } from "@/hooks/useBrowserPanelStore";
import { normalizeUrl } from "./normalizeUrl";

type NavigateEvent = Event & { url?: string };

// Electron augments the <webview> tag with navigation methods at runtime.
// @types/react gives us HTMLWebViewElement (a plain HTMLElement); we widen
// it locally with the methods we actually call.
type WebviewElement = HTMLWebViewElement & {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  stop: () => void;
  loadURL: (url: string) => Promise<void>;
  getURL: () => string;
};

const BLANK = "about:blank";

function urlForDisplay(url: string): string {
  return url === BLANK ? "" : url;
}

export function BrowserPanel({
  rightOffset = 0,
}: { rightOffset?: number } = {}) {
  const open = useBrowserPanelStore((s) => s.open);
  const setOpen = useBrowserPanelStore((s) => s.setOpen);
  const url = useBrowserPanelStore((s) => s.url);
  const setUrl = useBrowserPanelStore((s) => s.setUrl);

  // Capture src whenever the panel opens; subsequent navigation is driven
  // imperatively via loadURL so React doesn't fight the webview.
  const initialSrc = useMemo(() => url, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const webviewRef = useRef<WebviewElement | null>(null);
  const [inputValue, setInputValue] = useState(urlForDisplay(url));
  const [isLoading, setIsLoading] = useState(false);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  useEffect(() => {
    if (!open) return;
    const webview = webviewRef.current;
    if (!webview) return;

    const syncNav = () => {
      try {
        setCanBack(webview.canGoBack());
        setCanForward(webview.canGoForward());
      } catch {
        // webview not ready yet
      }
    };

    const onNavigate = (event: Event) => {
      const next = (event as NavigateEvent).url;
      if (next) {
        setUrl(next);
        setInputValue(urlForDisplay(next));
      }
      syncNav();
    };
    const onStart = () => setIsLoading(true);
    const onStop = () => {
      setIsLoading(false);
      syncNav();
    };
    const onDomReady = () => syncNav();

    webview.addEventListener("did-navigate", onNavigate);
    webview.addEventListener("did-navigate-in-page", onNavigate);
    webview.addEventListener("did-start-loading", onStart);
    webview.addEventListener("did-stop-loading", onStop);
    webview.addEventListener("dom-ready", onDomReady);

    return () => {
      webview.removeEventListener("did-navigate", onNavigate);
      webview.removeEventListener("did-navigate-in-page", onNavigate);
      webview.removeEventListener("did-start-loading", onStart);
      webview.removeEventListener("did-stop-loading", onStop);
      webview.removeEventListener("dom-ready", onDomReady);
    };
  }, [open, setUrl]);

  const submit = () => {
    const next = normalizeUrl(inputValue);
    setInputValue(urlForDisplay(next));
    void webviewRef.current?.loadURL(next);
  };

  const goBack = () => {
    const w = webviewRef.current;
    if (w?.canGoBack()) w.goBack();
  };
  const goForward = () => {
    const w = webviewRef.current;
    if (w?.canGoForward()) w.goForward();
  };
  const reload = () => {
    webviewRef.current?.reload();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="browser-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{ right: rightOffset }}
          className="absolute top-0 h-full w-1/3 min-w-[360px] z-30 bg-background border-l border-border flex flex-col shadow-lg"
        >
          <div className="flex h-12 items-center gap-1 px-2 border-b border-border no-drag">
            <button
              onClick={goBack}
              disabled={!canBack}
              title="Back"
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground/70 cursor-pointer disabled:cursor-default"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              onClick={goForward}
              disabled={!canForward}
              title="Forward"
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground/70 cursor-pointer disabled:cursor-default"
            >
              <ArrowRight size={14} />
            </button>
            <button
              onClick={reload}
              title="Reload"
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <RotateCw
                size={14}
                className={isLoading ? "animate-spin" : undefined}
              />
            </button>
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="Enter URL or localhost:3000"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="flex-1 h-7 rounded-md border border-border bg-muted px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => setOpen(false)}
              title="Close browser"
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <webview
            ref={(el) => {
              webviewRef.current = el as WebviewElement | null;
            }}
            src={initialSrc}
            allowpopups={true}
            partition="persist:browser-panel"
            className="flex-1 w-full"
            style={{ display: "flex" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
