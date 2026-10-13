import { glyphCells, glyphCols, glyphRows, scrambleChars } from "./font.js";

export { glyphCells, glyphCols, glyphRows, scrambleChars };

export type Dot = { x: number; y: number; r?: number };

export function textDots(text: string, pitch: number, originX: number, originY: number, r?: number): Dot[] {
  const dots: Dot[] = [];
  [...text].forEach((char, index) => {
    const left = originX + index * (glyphCols + 1) * pitch;
    for (const [col, row] of glyphCells(char)) dots.push({ x: left + col * pitch, y: originY + row * pitch, ...(r === undefined ? {} : { r }) });
  });
  return dots;
}

export function textWidth(length: number, pitch: number): number {
  return Math.max(0, length * (glyphCols + 1) - 1) * pitch;
}

export function scatterDots(width: number, height: number, pitch: number, clusters: number, random: () => number = Math.random): Dot[] {
  const dots: Dot[] = [];
  for (let i = 0; i < clusters; i++) {
    const char = scrambleChars[Math.floor(random() * scrambleChars.length)]!;
    const scale = random() < 0.4 ? 2 : 1;
    const x = Math.floor((random() * (width - glyphCols * pitch * scale)) / pitch) * pitch;
    const y = Math.floor((random() * (height - glyphRows * pitch * scale)) / pitch) * pitch;
    for (const [col, row] of glyphCells(char)) dots.push({ x: x + col * pitch * scale, y: y + row * pitch * scale });
  }
  return dots;
}

export function cardDots(centerX: number, centerY: number, width: number, pitch: number): Dot[] {
  const cols = Math.max(8, Math.floor(width / pitch));
  const rows = Math.max(5, Math.round(cols / 1.586));
  const left = centerX - (cols * pitch) / 2;
  const top = centerY - (rows * pitch) / 2;
  const dots: Dot[] = [];
  for (let col = 0; col <= cols; col++) {
    const corner = col === 0 || col === cols;
    for (const row of [0, rows]) if (!corner) dots.push({ x: left + col * pitch, y: top + row * pitch });
  }
  for (let row = 0; row <= rows; row++) {
    for (const col of [0, cols]) dots.push({ x: left + col * pitch, y: top + row * pitch });
  }
  for (let col = 2; col <= 4; col++) for (let row = 2; row <= 3; row++) dots.push({ x: left + col * pitch, y: top + row * pitch });
  return dots;
}

export function pairDots(from: Dot[], to: Dot[]): { from: Dot; to: Dot }[] {
  const count = Math.max(from.length, to.length);
  if (from.length === 0 || to.length === 0) return [];
  return Array.from({ length: count }, (_, i) => ({ from: from[i % from.length]!, to: to[i % to.length]! }));
}

export function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function pendingPercent(elapsedMs: number): number {
  return Math.min(94, Math.floor(94 * (1 - Math.exp(-elapsedMs / 1800))));
}

export function percentLabel(value: number): string {
  return `${String(Math.min(100, Math.max(0, Math.round(value)))).padStart(3, "0")}%`;
}

export const loaderTiming = { scrambleMs: 700, rushMs: 350, resolveMs: 900, holdMs: 350 };
