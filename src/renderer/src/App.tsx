import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { CanvasPage } from "./pages/CanvasPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { subscribeAskUserRequests } from "./hooks/useAskUserStore";
import { useApplyTheme } from "./hooks/useApplyTheme";
import { SearchModalProvider } from "./providers/SearchModalProvider";
import { CommandPaletteProvider } from "./providers/CommandPaletteProvider";

type Route =
  | { name: "home" }
  | { name: "onboarding" }
  | { name: "canvas"; id: string };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  if (h.startsWith("/canvas/")) return { name: "canvas", id: h.slice("/canvas/".length) };
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

  return (
    <SearchModalProvider>
      <CommandPaletteProvider>
        {route.name === "canvas" ? (
          <CanvasPage id={route.id} />
        ) : route.name === "onboarding" ? (
          <OnboardingPage />
        ) : (
          <HomePage />
        )}
      </CommandPaletteProvider>
    </SearchModalProvider>
  );
}
