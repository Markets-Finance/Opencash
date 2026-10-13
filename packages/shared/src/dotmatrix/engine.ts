import { cardDots, ease, loaderTiming, pairDots, pendingPercent, percentLabel, scatterDots, textDots, textWidth, type Dot } from "./index.js";

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

  function counter(percent: number): Dot[] {
    const text = percentLabel(percent);
    const originX = width - margin - textWidth(text.length, pitch);
    return [...textDots(text, pitch, originX, height * 0.42), ...textDots(">", pitch, margin, height * 0.62)];
  }

  function frame(now: number): Dot[] {
    const elapsed = now - start;
    if (resolveAt === null) {
      if (elapsed < loaderTiming.scrambleMs) {
        const slot = Math.floor(elapsed / 110);
        if (slot !== scatterSlot) {
          scatterSlot = slot;
          scatter = scatterDots(width, height, pitch, 6);
        }
        return scatter;
      }
      rushFrom = pendingPercent(elapsed - loaderTiming.scrambleMs);
      return counter(rushFrom);
    }
    const since = now - resolveAt;
    if (since < loaderTiming.rushMs) return counter(rushFrom + (100 - rushFrom) * ease(since / loaderTiming.rushMs));
    if (pairs.length === 0) pairs = pairDots(counter(100), cardDots(width / 2, height / 2, Math.min(width * 0.8, 360), pitch));
    const t = (since - loaderTiming.rushMs) / loaderTiming.resolveMs;
    if (!finished && since >= loaderTiming.rushMs + loaderTiming.resolveMs + loaderTiming.holdMs) {
      finished = true;
      done?.();
    }
    return pairs.map((pair, index) => {
      const local = ease(t * 1.4 - (index / pairs.length) * 0.4);
      return { x: pair.from.x + (pair.to.x - pair.from.x) * local, y: pair.from.y + (pair.to.y - pair.from.y) * local };
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
