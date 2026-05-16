import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { CanvasPage } from "./pages/CanvasPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { subscribeAskUserRequests } from "./hooks/useAskUserStore";
import { useApplyTheme } from "./hooks/useApplyTheme";
import { useRecentsStore } from "./hooks/useRecentsStore";

type Route =
  | { name: "home" }
  | { name: "onboarding" }
  | { name: "canvas"; ids: [string] | [string, string] };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  if (h.startsWith("/canvas/")) {
    const rest = h.slice("/canvas/".length);
    const parts = rest.split("/").filter(Boolean);
    if (parts.length >= 2) return { name: "canvas", ids: [parts[0], parts[1]] };
    if (parts.length === 1) return { name: "canvas", ids: [parts[0]] };
  }
  if (h === "/onboarding") return { name: "onboarding" };
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

  useEffect(() => {
    void useRecentsStore.getState().hydrate();
  }, []);

  // On first launch, redirect home → onboarding. Don't trap users elsewhere.
  useEffect(() => {
    if (route.name !== "home") return;
    let cancelled = false;
    void window.api.settings.read().then((s) => {
      if (cancelled) return;
      if (!s.onboardingCompleted) navigate("/onboarding");
    });
    return () => {
      cancelled = true;
    };
  }, [route.name]);

  useApplyTheme();

  if (route.name === "canvas") return <CanvasPage ids={route.ids} />;
  if (route.name === "onboarding") return <OnboardingPage />;
  return <HomePage />;
}
