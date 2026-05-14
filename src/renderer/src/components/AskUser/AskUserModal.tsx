import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleHelp, Check, X } from "lucide-react";
import type {
  AskUserAnswers,
  AskUserOption,
  AskUserQuestion,
  AskUserRequest,
} from "@shared/ipc";

type ActiveRequest = AskUserRequest;

export function AskUserModal() {
  const [active, setActive] = useState<ActiveRequest | null>(null);
  const [singleAnswers, setSingleAnswers] = useState<Record<number, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<number, Set<string>>>({});

  useEffect(() => {
    return window.api.askUser.onRequest((req) => {
      setActive(req);
      setSingleAnswers({});
      setMultiAnswers({});
    });
  }, []);

  const finish = useCallback(
    (req: ActiveRequest, payload: AskUserAnswers | null) => {
      if (payload === null) {
        void window.api.askUser.respond({ id: req.id, cancelled: true });
      } else {
        void window.api.askUser.respond({
          id: req.id,
          cancelled: false,
          answers: payload,
        });
      }
      setActive(null);
      setSingleAnswers({});
      setMultiAnswers({});
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(active, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!active) return null;

  const allAnswered = active.questions.every((q, i) => {
    if (q.multiSelect) return (multiAnswers[i]?.size ?? 0) > 0;
    return Boolean(singleAnswers[i]);
  });

  const submit = () => {
    const answers: AskUserAnswers = {};
    active.questions.forEach((q, i) => {
      if (q.multiSelect) {
        answers[q.question] = Array.from(multiAnswers[i] ?? []);
      } else {
        answers[q.question] = singleAnswers[i] ?? "";
      }
    });
    finish(active, answers);
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
    <AnimatePresence>
      <motion.div
        key="askuser-backdrop"
        className="fixed inset-0 z-[200] bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
      >
        <motion.div
          key="askuser-card"
          className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 4 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CircleHelp size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                Claude is asking{active.questions.length > 1 ? ` ${active.questions.length} questions` : ""}
              </span>
            </div>
            <button
              onClick={() => finish(active, null)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {active.questions.map((q, idx) => (
              <QuestionBlock
                key={idx}
                question={q}
                singleAnswer={singleAnswers[idx]}
                multiAnswers={multiAnswers[idx]}
                onPickSingle={(label) =>
                  setSingleAnswers((p) => ({ ...p, [idx]: label }))
                }
                onToggleMulti={(label) => toggleMulti(idx, label)}
              />
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              onClick={() => finish(active, null)}
              className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!allAnswered}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check size={12} />
              Submit
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

type QuestionBlockProps = {
  question: AskUserQuestion;
  singleAnswer: string | undefined;
  multiAnswers: Set<string> | undefined;
  onPickSingle: (label: string) => void;
  onToggleMulti: (label: string) => void;
};

function QuestionBlock({
  question,
  singleAnswer,
  multiAnswers,
  onPickSingle,
  onToggleMulti,
}: QuestionBlockProps) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
        <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide rounded bg-card border border-border text-foreground">
          {question.header}
        </span>
        {question.multiSelect && (
          <span className="text-[9px] text-muted-foreground">multi-select</span>
        )}
      </div>
      <div className="px-3 py-2 text-sm text-foreground">{question.question}</div>
      <div className="flex flex-col gap-1 p-2 pt-0">
        {question.options.map((opt) => {
          const selected = question.multiSelect
            ? multiAnswers?.has(opt.label) ?? false
            : singleAnswer === opt.label;
          return (
            <OptionButton
              key={opt.label}
              option={opt}
              selected={selected}
              multi={question.multiSelect}
              onClick={() =>
                question.multiSelect
                  ? onToggleMulti(opt.label)
                  : onPickSingle(opt.label)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function OptionButton({
  option,
  selected,
  multi,
  onClick,
}: {
  option: AskUserOption;
  selected: boolean;
  multi: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md border px-3 py-2 transition-colors cursor-pointer flex items-start gap-2 ${
        selected
          ? "border-foreground/40 bg-accent"
          : "border-border hover:bg-muted"
      }`}
    >
      <div
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center ${
          multi ? "rounded-sm" : "rounded-full"
        } border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}
      >
        {selected && <Check size={10} strokeWidth={3} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{option.label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {option.description}
        </div>
        {option.preview && (
          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted px-2 py-1 font-mono text-[10px] leading-snug text-foreground">
            {option.preview}
          </pre>
        )}
      </div>
    </button>
  );
}
