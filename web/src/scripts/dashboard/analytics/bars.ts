import { compact } from "./format";

export type Point = { t: number; v: number };

let counter = 0;

export function drawBars(container: HTMLElement, points: Point[], options: { cumulative?: boolean } = {}) {
  if (points.length === 0) {
    container.innerHTML = `<div class="chart-empty">No data in this range yet.</div>`;
    return;
  }
  const id = `hatch-${(counter += 1)}`;
  const values = options.cumulative ? points.reduce<number[]>((acc, p) => [...acc, (acc[acc.length - 1] ?? 0) + p.v], []) : points.map((p) => p.v);
  const max = Math.max(...values, 1);
  const width = 960;
  const height = 280;
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const slot = (width - pad.l - pad.r) / values.length;
  const bar = Math.max(2, slot * 0.72);
  const labelEvery = Math.max(1, Math.ceil(values.length / 8));
  const bars = values
    .map((value, i) => {
      const h = Math.max(2, (value / max) * (height - pad.t - pad.b));
      const x = pad.l + i * slot + (slot - bar) / 2;
      const y = height - pad.b - h;
      const last = i === values.length - 1;
      return `<rect class="bars__bar${last ? " bars__bar--last" : ""}" data-i="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bar.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(8, bar / 2).toFixed(1)}" fill="${last ? "currentColor" : `url(#${id})`}"/>`;
    })
    .join("");
  const labels = points
    .map((p, i) =>
      i % labelEvery === 0 && (points.length - 1 - i >= labelEvery / 2 || i === points.length - 1)
        ? `<text x="${(pad.l + i * slot + slot / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>`
        : "",
    )
    .join("");
  container.innerHTML = `<div class="bars"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Volume chart">
    <defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(180,245,140,0.10)"/><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(180,245,140,0.55)" stroke-width="1.6"/></pattern></defs>
    ${bars}<g class="bars__labels">${labels}</g></svg><div class="bars__tip" hidden></div></div>`;
  const tip = container.querySelector<HTMLElement>(".bars__tip")!;
  const root = container.querySelector<HTMLElement>(".bars")!;
  container.querySelectorAll<SVGRectElement>(".bars__bar").forEach((rect) => {
    rect.addEventListener("pointerenter", () => {
      const i = Number(rect.dataset.i);
      const box = rect.getBoundingClientRect();
      const host = root.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = `<b>${compact(values[i]!)}</b><small>${new Date(points[i]!.t).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</small>`;
      tip.style.left = `${Math.min(host.width - 120, Math.max(0, box.left - host.left + box.width / 2 - 55))}px`;
      tip.style.top = `${Math.max(0, box.top - host.top - 58)}px`;
    });
    rect.addEventListener("pointerleave", () => (tip.hidden = true));
  });
}
