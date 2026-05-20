// Ported 1:1 from avera/app/features/canvas/lib/group-summary/group-pairs.ts.
// Same Jaccard-similarity clustering + fallback title generation so that the
// grouping convention matches avera exactly.

import type {
  GeneratedGroupSummary,
  GroupSummaryCandidate,
} from "./groupSummary";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
]);
const TOPIC_STOP_WORDS = new Set([
  ...STOP_WORDS,
  "discussion",
  "conversations",
  "conversation",
  "topic",
  "topics",
  "related",
  "details",
  "group",
  "focus",
  "additional",
  "major",
  "majors",
]);

const SIMILARITY_THRESHOLD = 0.2;

type PairGroup = {
  candidates: GroupSummaryCandidate[];
  keywords: Set<string>;
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function toKeywordSet(candidate: GroupSummaryCandidate): Set<string> {
  return new Set(tokenize(candidate.prompt));
}

function topicTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !TOPIC_STOP_WORDS.has(word));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function wordsFromPrompt(prompt: string): string[] {
  return prompt
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 10);
}

function clipTitleWords(value: string, maxWords = 10): string {
  const words = value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return "Related Conversation Group";
  return words.slice(0, maxWords).join(" ");
}

function toBookTitleCase(value: string): string {
  const smallWords = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "in",
    "nor",
    "of",
    "on",
    "or",
    "the",
    "to",
    "up",
    "via",
    "with",
  ]);

  const words = value
    .replace(/^overview(\s+of)?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) return "Related Conversation Group";

  const clipped = words.slice(0, 10);

  return clipped
    .map((word, index) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      const isBoundary = index === 0 || index === clipped.length - 1;
      if (!isBoundary && smallWords.has(lower)) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function buildFallbackTitle(group: PairGroup): string {
  const keywordCounts = new Map<string, number>();
  for (const candidate of group.candidates) {
    for (const token of tokenize(candidate.prompt)) {
      keywordCounts.set(token, (keywordCounts.get(token) ?? 0) + 1);
    }
  }

  const keywordWords = Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 4);

  if (keywordWords.length >= 2) {
    return toBookTitleCase(
      clipTitleWords(`${keywordWords.join(" and ")} Discussion`),
    );
  }

  const [first] = group.candidates;
  const promptWords = first ? wordsFromPrompt(first.prompt) : [];
  if (promptWords.length >= 3) {
    return toBookTitleCase(clipTitleWords(promptWords.join(" ")));
  }

  return "Related Conversation Group";
}

function buildGroupKeywordRanking(group: PairGroup): string[] {
  const counts = new Map<string, number>();
  for (const candidate of group.candidates) {
    for (const token of topicTokens(candidate.prompt)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);
}

function buildUniqueFallbackTitle(
  group: PairGroup,
  usedKeywords: Set<string>,
  index: number,
): string {
  const rankedKeywords = buildGroupKeywordRanking(group);
  const uniqueKeywords = rankedKeywords.filter((token) => !usedKeywords.has(token));
  const selected = uniqueKeywords.slice(0, 3);

  let rawTitle = "";
  if (selected.length >= 2) {
    rawTitle = `${selected[0]} and ${selected[1]} ${selected[2] ?? ""}`.trim();
  } else if (selected.length === 1) {
    rawTitle = `${selected[0]} Topic ${index + 1}`;
  } else {
    rawTitle = buildFallbackTitle(group);
  }

  const title = toBookTitleCase(clipTitleWords(rawTitle));
  for (const token of topicTokens(title)) {
    usedKeywords.add(token);
  }

  return title;
}

function mergeGroupPair(a: PairGroup, b: PairGroup): PairGroup {
  const keywords = new Set<string>(a.keywords);
  for (const token of b.keywords) keywords.add(token);
  return {
    candidates: [...a.candidates, ...b.candidates],
    keywords,
  };
}

function mergeClosestGroups(
  groups: PairGroup[],
  targetCount: number,
): PairGroup[] {
  const merged = groups.map((group) => ({
    candidates: [...group.candidates],
    keywords: new Set(group.keywords),
  }));

  while (merged.length > targetCount) {
    let bestI = 0;
    let bestJ = 1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < merged.length - 1; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        const score = jaccard(merged[i].keywords, merged[j].keywords);
        if (score > bestScore) {
          bestScore = score;
          bestI = i;
          bestJ = j;
        }
      }
    }

    const next = mergeGroupPair(merged[bestI], merged[bestJ]);
    merged[bestI] = next;
    merged.splice(bestJ, 1);
  }

  return merged;
}

export function groupPairCandidates(
  candidates: GroupSummaryCandidate[],
): PairGroup[] {
  const groups: PairGroup[] = [];

  for (const candidate of candidates) {
    const candidateKeywords = toKeywordSet(candidate);
    let bestGroup: PairGroup | null = null;
    let bestScore = 0;

    for (const group of groups) {
      const score = jaccard(candidateKeywords, group.keywords);
      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }

    if (!bestGroup || bestScore < SIMILARITY_THRESHOLD) {
      groups.push({
        candidates: [candidate],
        keywords: new Set(candidateKeywords),
      });
      continue;
    }

    bestGroup.candidates.push(candidate);
    for (const token of candidateKeywords) {
      bestGroup.keywords.add(token);
    }
  }

  const hasMultiNodeGroup = groups.some((group) => group.candidates.length > 1);
  if (hasMultiNodeGroup || candidates.length <= 3) {
    return groups;
  }

  const targetGroupCount = Math.max(1, Math.ceil(candidates.length / 2));
  return mergeClosestGroups(groups, targetGroupCount);
}

export function buildFallbackGroupSummaries(
  candidates: GroupSummaryCandidate[],
): GeneratedGroupSummary[] {
  const groups = groupPairCandidates(candidates);
  const usedKeywords = new Set<string>();

  return groups.map((group, index) => {
    const distinctTitle = buildUniqueFallbackTitle(group, usedKeywords, index);

    return {
      title: distinctTitle,
      nodeIds: group.candidates.map((candidate) => candidate.nodeId),
      metadata: { confidence: 0.35 },
    };
  });
}
