import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { CanvasPage } from "./pages/CanvasPage";

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

  if (route.name === "canvas") return <CanvasPage id={route.id} />;
  return <HomePage />;
}
