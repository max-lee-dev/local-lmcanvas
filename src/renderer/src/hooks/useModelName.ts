import { useEffect, useState } from "react";

const DEFAULT_LABEL = "Opus 4.7";

export function useModelName(): string {
  const [name, setName] = useState<string>(DEFAULT_LABEL);
  useEffect(() => {
    void window.api.settings.read().then((s) => {
      setName(prettyModelName(s.claudeModel));
    });
  }, []);
  return name;
}

function prettyModelName(id?: string): string {
  if (!id) return DEFAULT_LABEL;
  if (id.includes("opus")) {
    if (id.includes("4-7")) return "Opus 4.7";
    if (id.includes("4-6")) return "Opus 4.6";
    if (id.includes("4-5")) return "Opus 4.5";
    return "Opus";
  }
  if (id.includes("sonnet")) {
    if (id.includes("4-6")) return "Sonnet 4.6";
    if (id.includes("4-5")) return "Sonnet 4.5";
    return "Sonnet";
  }
  if (id.includes("haiku")) {
    if (id.includes("4-5")) return "Haiku 4.5";
    return "Haiku";
  }
  return id;
}
