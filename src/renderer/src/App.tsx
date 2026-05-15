import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { CanvasPage } from "./pages/CanvasPage";
import { subscribeAskUserRequests } from "./hooks/useAskUserStore";
import { useApplyTheme } from "./hooks/useApplyTheme";
import { SearchModalProvider } from "./providers/SearchModalProvider";

type Route =
  | { name: "home" }
  | { name: "canvas"; id: string };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  if (h.startsWith("/canvas/")) return { name: "canvas", id: h.slice("/canvas/".length) };
  return { name: "home" };
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => subscribeAskUserRequests(), []);

  useApplyTheme();

  return (
    <SearchModalProvider>
      {route.name === "canvas" ? <CanvasPage id={route.id} /> : <HomePage />}
    </SearchModalProvider>
  );
}
