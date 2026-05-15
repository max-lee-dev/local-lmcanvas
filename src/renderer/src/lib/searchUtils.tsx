import React from "react";

export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getHighlightRegex = (query: string): RegExp | null => {
  const tokens = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return null;
  return new RegExp(`(${tokens.join("|")})`, "ig");
};

export const highlightMatches = (
  text: string,
  query: string,
): React.ReactNode => {
  if (!text || !query.trim()) return text;
  const regex = getHighlightRegex(query);
  if (!regex) return text;
  const parts = text.split(regex);
  const highlightClass = "bg-yellow-200/40 rounded px-0";
  return parts.map((part, idx) => {
    const isMatch = idx % 2 === 1;
    return isMatch ? (
      <span key={idx} className={highlightClass}>
        {part}
      </span>
    ) : (
      <span key={idx}>{part}</span>
    );
  });
};

export const stripMarkdownToPlainText = (markdown: string): string => {
  if (!markdown) return "";
  let text = markdown;
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
};

export const getResponseSnippet = (content: string, query: string): string => {
  if (!content) return "";
  const trimmedQuery = query.trim();
  const FALLBACK_LENGTH = 200;
  const CONTEXT_BEFORE = 80;
  const CONTEXT_AFTER = 200;

  if (!trimmedQuery) return content.slice(0, FALLBACK_LENGTH);

  const regex = getHighlightRegex(trimmedQuery);
  if (!regex) return content.slice(0, FALLBACK_LENGTH);

  regex.lastIndex = 0;
  const match = regex.exec(content);
  if (!match) return content.slice(0, FALLBACK_LENGTH);

  const matchIndex = match.index;
  const start = Math.max(0, matchIndex - CONTEXT_BEFORE);
  const end = Math.min(
    content.length,
    matchIndex + match[0].length + CONTEXT_AFTER,
  );
  const prefix = start > 0 ? "… " : "";
  const suffix = end < content.length ? " …" : "";

  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
};
