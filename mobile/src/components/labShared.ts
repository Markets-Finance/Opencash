import type { templates } from "shared";

export const tints = { purple: "#8f7cf5", lime: "#b4f58c", blue: "#6fb7f2", peach: "#f2b98b" } as const;

export const meta: Record<templates.TemplateId, { tint: keyof typeof tints; glyph: string }> = {
  donchian: { tint: "purple", glyph: "↗" },
  dca: { tint: "lime", glyph: "≡" },
  grid: { tint: "blue", glyph: "▦" },
  trail: { tint: "peach", glyph: "◇" },
};

export function pct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function money(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function sample(values: number[], max = 90): number[] {
  if (values.length <= max) return values;
  const step = (values.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]!);
}

export function price(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 2 : 4 })}`;
}
