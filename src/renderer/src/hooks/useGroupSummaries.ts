import { useMemo } from "react";
import type {
  GroupSummary,
  GroupSummaryCandidate,
} from "@/lib/groupSummary";
import { buildFallbackGroupSummaries } from "@/lib/groupClustering";

type Result = {
  summaries: GroupSummary[];
  isGenerating: boolean;
};

/** Build an id keyed by the sorted node set so that when the LLM call resolves,
 *  a group covering the same nodes gets the same key as its heuristic
 *  predecessor — the title swaps in place without the AnimatePresence remount
 *  flash. */
function stableGroupId(nodeIds: string[]): string {
  return `g:${nodeIds.slice().sort().join("/")}`;
}

function fallbackSummaries(
  candidates: GroupSummaryCandidate[],
): GroupSummary[] {
  return buildFallbackGroupSummaries(candidates).map((g) => ({
    id: stableGroupId(g.nodeIds),
    title: g.title,
    nodeIds: g.nodeIds,
  }));
}

export function useGroupSummaries(
  candidates: GroupSummaryCandidate[],
): Result {
  const summaries = useMemo(
    () => (candidates.length >= 2 ? fallbackSummaries(candidates) : []),
    [candidates],
  );
  return { summaries, isGenerating: false };
}
