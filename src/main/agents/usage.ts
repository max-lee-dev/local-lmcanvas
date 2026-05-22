import type { UsageSummary } from "@shared/types";

export function normalizeUsage(
  raw: unknown,
  extras?: { totalCostUsd?: unknown },
): UsageSummary | undefined {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const usage: UsageSummary = {};

  const inputTokens = firstNumber(
    obj.input_tokens,
    obj.inputTokens,
    obj.prompt_tokens,
    obj.promptTokens,
  );
  if (inputTokens !== undefined) usage.inputTokens = inputTokens;

  const outputTokens = firstNumber(
    obj.output_tokens,
    obj.outputTokens,
    obj.completion_tokens,
    obj.completionTokens,
  );
  if (outputTokens !== undefined) usage.outputTokens = outputTokens;

  const cachedInputTokens = firstNumber(obj.cached_input_tokens, obj.cachedInputTokens);
  if (cachedInputTokens !== undefined) usage.cachedInputTokens = cachedInputTokens;

  const cacheReadInputTokens = firstNumber(
    obj.cache_read_input_tokens,
    obj.cacheReadInputTokens,
  );
  if (cacheReadInputTokens !== undefined) {
    usage.cacheReadInputTokens = cacheReadInputTokens;
  }

  const cacheCreationInputTokens = firstNumber(
    obj.cache_creation_input_tokens,
    obj.cacheCreationInputTokens,
  );
  if (cacheCreationInputTokens !== undefined) {
    usage.cacheCreationInputTokens = cacheCreationInputTokens;
  }

  const reasoningOutputTokens = firstNumber(
    obj.reasoning_output_tokens,
    obj.reasoningOutputTokens,
  );
  if (reasoningOutputTokens !== undefined) {
    usage.reasoningOutputTokens = reasoningOutputTokens;
  }

  const totalTokens = firstNumber(obj.total_tokens, obj.totalTokens);
  if (totalTokens !== undefined) {
    usage.totalTokens = totalTokens;
  } else if (inputTokens !== undefined || outputTokens !== undefined) {
    usage.totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0);
  }

  const totalCostUsd = firstNumber(
    extras?.totalCostUsd,
    obj.total_cost_usd,
    obj.totalCostUsd,
    obj.cost_usd,
    obj.costUsd,
  );
  if (totalCostUsd !== undefined) usage.totalCostUsd = totalCostUsd;

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}
