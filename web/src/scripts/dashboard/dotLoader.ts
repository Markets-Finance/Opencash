import { createLoaderEngine } from "shared";

export type DotLoader = { resolve: () => Promise<void>; dismiss: () => Promise<void> };

const idle: DotLoader = { resolve: async () => {}, dismiss: async () => {} };

export function startDotLoader(label = "SIGNING…"): DotLoader {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return idle;

  const style = getComputedStyle(document.body);
  const ink = style.color || "#ffffff";
  const paper = style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" ? style.backgroundColor : "#0b0f0e";
  const overlay = document.createElement("div");
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:${paper};opacity:1;transition:opacity 320ms ease`;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  const tag = document.createElement("span");
  tag.textContent = label;
  tag.style.cssText = "position:absolute;left:24px;top:22px;font:600 11px/1 'DM Sans',system-ui,sans-serif;letter-spacing:0.12em;color:#7165ed";
  overlay.append(canvas, tag);
  document.body.append(overlay);

  const context = canvas.getContext("2d")!;
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);

  const engine = createLoaderEngine(width, height, Date.now());
  const radius = engine.pitch * 0.38;
  let frame = 0;

  function tick() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = ink;
    context.beginPath();
    for (const dot of engine.frame(Date.now())) {
      context.moveTo(dot.x + radius, dot.y);
      context.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    }
    context.fill();
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return {
    resolve: () => engine.resolve(Date.now()),
    dismiss: () =>
      new Promise((done) => {
        overlay.style.opacity = "0";
        setTimeout(() => {
          cancelAnimationFrame(frame);
          overlay.remove();
          done();
        }, 340);
      }),
  };
}
