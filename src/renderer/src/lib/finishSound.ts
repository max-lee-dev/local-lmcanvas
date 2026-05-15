// Sounds synthesized via the Web Audio API. The AudioContext lives outside any
// React component so a single instance is reused across all nodes.

import type { FinishSound } from "@/hooks/usePreferencesStore";

type WindowWithWebkit = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Note = {
  freq: number;
  offset: number;
  duration?: number;
  type?: OscillatorType;
  peak?: number;
};

function playNotes(notes: Note[]): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  for (const note of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;
    const start = now + note.offset;
    const duration = note.duration ?? 0.42;
    const peak = note.peak ?? 0.06;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.04);
  }
}

export const FINISH_SOUND_LABELS: Record<FinishSound, string> = {
  chime: "Chime",
  pop: "Pop",
  ding: "Ding",
  bloop: "Bloop",
};

export function playFinishSound(variant: FinishSound = "chime"): void {
  switch (variant) {
    case "chime":
      // E5 → G5 ascending blip.
      playNotes([
        { freq: 659.25, offset: 0 },
        { freq: 783.99, offset: 0.09 },
      ]);
      return;
    case "pop":
      // Brief high blip with a quick decay.
      playNotes([
        { freq: 880, offset: 0, duration: 0.16, peak: 0.07, type: "triangle" },
      ]);
      return;
    case "ding":
      // Bell-like single note, longer tail.
      playNotes([
        { freq: 1318.5, offset: 0, duration: 0.7, peak: 0.05, type: "sine" },
        { freq: 2637, offset: 0, duration: 0.55, peak: 0.02, type: "sine" },
      ]);
      return;
    case "bloop":
      // Low, soft descending note.
      playNotes([
        { freq: 392, offset: 0, duration: 0.25, peak: 0.07, type: "sine" },
        { freq: 261.63, offset: 0.08, duration: 0.3, peak: 0.06, type: "sine" },
      ]);
      return;
  }
}
