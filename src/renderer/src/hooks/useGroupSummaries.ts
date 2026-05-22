import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GroupSummary,
  GroupSummaryCandidate,
} from "@/lib/groupSummary";
import { buildFallbackGroupSummaries } from "@/lib/groupClustering";

// Wait this long after the candidate set stops changing before kicking off the
// LLM call. Avoids spamming the model while the user is typing or while chats
// stream in. The heuristic still renders immediately during this window.
const DEBOUNCE_MS = 1200;

type Result = {
  summaries: GroupSummary[];
  /** True from the moment the candidate set changes until either the LLM
   *  call resolves (success or fallback). The overlay uses this to render
   *  the shimmering skeleton boxes. */
  isGenerating: boolean;
};

/** Stable identity for a candidate set. Used both as a useEffect dep and as
 *  a fingerprint that lets us skip re-running when nothing actually changed.
 *  We include a short prompt prefix so editing a node's prompt invalidates the
 *  cached titles even when node count is unchanged. */
function fingerprint(candidates: GroupSummaryCandidate[]): string {
  return candidates
    .slice()
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId))
    .map((c) => `${c.nodeId}:${c.prompt.length}:${c.prompt.slice(0, 80)}`)
    .join("|");
}

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
  const fp = useMemo(() => fingerprint(candidates), [candidates]);

  // The latest candidates array (held in a ref so the LLM-call effect can read
  // it without depending on array identity and re-firing every render).
  const candidatesRef = useRef(candidates);
  useEffect(() => {
    candidatesRef.current = candidates;
  });

  const [summaries, setSummaries] = useState<GroupSummary[]>(() =>
    candidates.length >= 2 ? fallbackSummaries(candidates) : [],
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Bumped on every fingerprint change so an in-flight LLM call from a stale
  // fingerprint can detect it has been superseded and drop its result.
  const callIdRef = useRef(0);

  useEffect(() => {
    const current = candidatesRef.current;
    if (current.length < 2) {
      setSummaries([]);
      setIsGenerating(false);
      return;
    }

    // Show the heuristic immediately while the model spins up.
    setSummaries(fallbackSummaries(current));
    setIsGenerating(true);

    callIdRef.current += 1;
    const callId = callIdRef.current;

    const timeout = setTimeout(async () => {
      let generated: { title: string; nodeIds: string[] }[] | null = null;
      try {
        generated = await window.api.groupSummary.generate({
          candidates: current.map((c) => ({
            nodeId: c.nodeId,
            prompt: c.prompt,
          })),
        });
      } catch (err) {
        console.warn("[useGroupSummaries] generate failed:", err);
      }

      if (callId !== callIdRef.current) return;

      if (generated && generated.length > 0) {
        setSummaries(
          generated.map((g) => ({
            id: stableGroupId(g.nodeIds),
            title: g.title,
            nodeIds: g.nodeIds,
          })),
        );
      }
      setIsGenerating(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fp]);

  return { summaries, isGenerating };
}
