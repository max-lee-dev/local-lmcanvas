import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import clsx from "clsx";
import type {
  AskUserAnswers,
  AskUserOption,
  AskUserQuestion,
  AskUserRequest,
} from "@shared/ipc";
import { useAskUserStore } from "@/hooks/useAskUserStore";

type Props = {
  request: AskUserRequest;
};

export function AskUserPrompt({ request }: Props) {
  const resolve = useAskUserStore((s) => s.resolve);
  const cancel = useAskUserStore((s) => s.cancel);

  const [singleAnswers, setSingleAnswers] = useState<Record<number, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<number, Set<string>>>({});
  const [freeAnswers, setFreeAnswers] = useState<Record<number, string>>({});

  const allAnswered = request.questions.every((q, i) => {
    if (q.required === false) return true;
    const hasFreeAnswer = Boolean(freeAnswers[i]?.trim());
    if (q.multiSelect) return (multiAnswers[i]?.size ?? 0) > 0 || hasFreeAnswer;
    return Boolean(singleAnswers[i]) || hasFreeAnswer;
  });

  const submit = () => {
    const answers: AskUserAnswers = {};
    request.questions.forEach((q, i) => {
      const key = q.id ?? q.question;
      const freeAnswer = freeAnswers[i]?.trim();
      if (q.multiSelect) {
        answers[key] = [
          ...Array.from(multiAnswers[i] ?? []),
          ...(freeAnswer ? [freeAnswer] : []),
        ];
      } else {
        answers[key] = singleAnswers[i] ?? freeAnswer ?? "";
      }
    });
    resolve(request.id, answers);
  };

  const toggleMulti = (qIdx: number, label: string) => {
    setMultiAnswers((prev) => {
      const next = { ...prev };
      const set = new Set(next[qIdx] ?? []);
      if (set.has(label)) set.delete(label);
      else set.add(label);
      next[qIdx] = set;
      return next;
    });
  };

  return (
    <motion.div
      className="nodrag my-2 rounded-[8px] border border-border bg-card overflow-hidden"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      <div className="flex flex-col gap-2 p-2">
        {request.questions.map((q, idx) => (
          <QuestionBlock
            key={idx}
            question={q}
            singleAnswer={singleAnswers[idx]}
            multiAnswers={multiAnswers[idx]}
            onPickSingle={(label) =>
              setSingleAnswers((p) => ({ ...p, [idx]: label }))
            }
            onToggleMulti={(label) => toggleMulti(idx, label)}
            freeAnswer={freeAnswers[idx] ?? ""}
            onFreeAnswerChange={(value) =>
              setFreeAnswers((previous) => ({ ...previous, [idx]: value }))
            }
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-t border-border bg-muted/20">
        <button
          type="button"
          onClick={() => cancel(request.id)}
          className="px-2 py-1 text-[10px] rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-foreground text-card hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Check className="h-2.5 w-2.5" />
          Submit
        </button>
      </div>
    </motion.div>
  );
}

type QuestionBlockProps = {
  question: AskUserQuestion;
  singleAnswer: string | undefined;
  multiAnswers: Set<string> | undefined;
  onPickSingle: (label: string) => void;
  onToggleMulti: (label: string) => void;
  freeAnswer: string;
  onFreeAnswerChange: (value: string) => void;
};

function QuestionBlock({
  question,
  singleAnswer,
  multiAnswers,
  onPickSingle,
  onToggleMulti,
  freeAnswer,
  onFreeAnswerChange,
}: QuestionBlockProps) {
  return (
    <div className="rounded border border-border overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border bg-muted/30">
        <span className="px-1 py-0.5 text-[8px] font-medium uppercase tracking-wide rounded bg-card border border-border text-foreground">
          {question.header}
        </span>
        {question.multiSelect && (
          <span className="text-[8px] text-muted-foreground">multi-select</span>
        )}
      </div>
      <div className="px-2 py-1 text-[10px] text-foreground">{question.question}</div>
      <div className="flex flex-col gap-1 p-1.5 pt-0">
        {question.options.map((opt) => {
          const optionValue = opt.value ?? opt.label;
          const selected = question.multiSelect
            ? multiAnswers?.has(optionValue) ?? false
            : singleAnswer === optionValue;
          return (
            <OptionButton
              key={opt.label}
              option={opt}
              selected={selected}
              multi={question.multiSelect}
              onClick={() =>
                question.multiSelect
                  ? onToggleMulti(optionValue)
                  : onPickSingle(optionValue)
              }
            />
          );
        })}
        {question.allowFreeText &&
          (question.secret ? (
            <input
              type="password"
              value={freeAnswer}
              onChange={(event) => onFreeAnswerChange(event.target.value)}
              placeholder="Enter a private answer…"
              aria-label={`${question.header} private answer`}
              autoComplete="off"
              className="nodrag w-full rounded border border-border bg-background px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
            />
          ) : (
            <textarea
              value={freeAnswer}
              onChange={(event) => onFreeAnswerChange(event.target.value)}
              rows={2}
              placeholder="Type another answer…"
              aria-label={`${question.header} custom answer`}
              className="nodrag w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
            />
          ))}
      </div>
    </div>
  );
}

type OptionButtonProps = {
  option: AskUserOption;
  selected: boolean;
  multi: boolean;
  onClick: () => void;
};

function OptionButton({ option, selected, multi, onClick }: OptionButtonProps) {
  return (
    <AnimatePresence>
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        className={clsx(
          "w-full text-left rounded border px-2 py-1.5 transition-colors cursor-pointer flex items-start gap-1.5",
          selected
            ? "border-foreground/40 bg-accent"
            : "border-border hover:bg-muted"
        )}
      >
        <div
          className={clsx(
            "mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center border",
            multi ? "rounded-sm" : "rounded-full",
            selected
              ? "border-foreground bg-foreground text-card"
              : "border-border"
          )}
        >
          {selected && <Check className="h-2 w-2" strokeWidth={3} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium text-foreground leading-tight">
            {option.label}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5 leading-snug">
            {option.description}
          </div>
          {option.preview && (
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-muted px-1.5 py-1 font-mono text-[9px] leading-snug text-foreground">
              {option.preview}
            </pre>
          )}
        </div>
      </motion.button>
    </AnimatePresence>
  );
}
