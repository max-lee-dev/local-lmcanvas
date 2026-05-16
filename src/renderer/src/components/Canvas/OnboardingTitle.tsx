import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const SUBTITLES = [
  "Branch off your AI conversations",
  "Try right-clicking to add a node",
  "Each node has its own model, folder, branch",
];

const ROTATE_INTERVAL_MS = 3500;

export function OnboardingTitle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % SUBTITLES.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      className="pointer-events-none absolute left-0 right-0 flex flex-col items-center text-center select-none"
      style={{
        bottom: "100%",
        paddingBottom: 24,
        fontFamily: "var(--font-geist-pixel-square)",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <h1 className="text-5xl font-bold tracking-tight text-foreground/90 mb-2">
        LMCanvas
      </h1>
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          className="text-base text-muted-foreground/60 whitespace-nowrap"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {SUBTITLES[index]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}
