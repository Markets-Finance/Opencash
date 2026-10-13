import { ease, loaderTiming, pairDots, pendingPercent, percentLabel, scatterDots, textDots, textWidth, type Dot } from "./index.js";

export type LoaderEngine = {
  pitch: number;
  frame: (now: number) => Dot[];
  resolve: (now: number) => Promise<void>;
};

export function createLoaderEngine(width: number, height: number, start: number): LoaderEngine {
  const pitch = Math.min(22, Math.max(5, width * 0.024));
  const margin = 24;
  let scatter: Dot[] = [];
  let scatterSlot = -1;
  let resolveAt: number | null = null;
  let rushFrom = 0;
  let pairs: { from: Dot; to: Dot }[] = [];
  let done: (() => void) | null = null;
  let finished = false;

  const small = pitch * 0.55;
  const wordTop = height * 0.14;

  function words(): Dot[] {
    return [
      ...textDots("MERA", small, margin, wordTop, small * 0.38),
      ...textDots("PASSKEY", small, margin, wordTop + small * 9, small * 0.38),
    ];
  }

  function loginDots(): Dot[] {
    const available = width - margin * 2;
    const fit = Math.min(1, (height * 0.7) / (21.5 * pitch));
    const big = Math.min(pitch * fit, available / textWidth(4, 1));
    const small = Math.min(pitch * fit, available / textWidth(8, 1));
    const gap = big * 2.5;
    const total = 6 * big + gap + 6 * small + gap + 6 * small;
    const centered = (word: string, size: number) => (width - textWidth(word.length, size)) / 2;
    const top = height / 2 - total / 2;
    const middle = top + 6 * big + gap;
    const bottom = middle + 6 * small + gap;
    return [
      ...textDots("MERA", big, centered("MERA", big), top),
      ...textDots("X", small, centered("X", small), middle),
      ...textDots("OPENCASH", small, centered("OPENCASH", small), bottom),
    ];
  }

  function counter(percent: number): Dot[] {
    const text = percentLabel(percent);
    const originX = width - margin - textWidth(text.length, pitch);
    return [
      ...words(),
      ...textDots(text, pitch, originX, height * 0.42),
      ...textDots(">", pitch, margin, height * 0.62),
    ];
  }

  function frame(now: number): Dot[] {
    const elapsed = now - start;
    if (resolveAt === null) {
      if (elapsed < loaderTiming.scrambleMs) {
        const slot = Math.floor(elapsed / 110);
        if (slot !== scatterSlot) {
          scatterSlot = slot;
          scatter = scatterDots(width, height - 120, pitch, 6);
        }
        return [...words(), ...scatter];
      }
      rushFrom = pendingPercent(elapsed - loaderTiming.scrambleMs);
      return counter(rushFrom);
    }
    const since = now - resolveAt;
    if (since < loaderTiming.rushMs) return counter(rushFrom + (100 - rushFrom) * ease(since / loaderTiming.rushMs));
    if (pairs.length === 0) pairs = pairDots(counter(100), loginDots());
    const t = (since - loaderTiming.rushMs) / loaderTiming.resolveMs;
    if (!finished && since >= loaderTiming.rushMs + loaderTiming.resolveMs + loaderTiming.holdMs) {
      finished = true;
      done?.();
    }
    return pairs.map((pair, index) => {
      const local = ease(t * 1.4 - (index / pairs.length) * 0.4);
      const base = pitch * 0.38;
      const from = pair.from.r ?? base;
      const to = pair.to.r ?? base;
      return { x: pair.from.x + (pair.to.x - pair.from.x) * local, y: pair.from.y + (pair.to.y - pair.from.y) * local, r: from + (to - from) * local };
    });
  }

  function resolve(now: number): Promise<void> {
    const wait = Math.max(0, loaderTiming.scrambleMs - (now - start));
    return new Promise((resolved) => {
      done = resolved;
      setTimeout(() => {
        resolveAt = Date.now();
      }, wait);
    });
  }

  return { pitch, frame, resolve };
}
