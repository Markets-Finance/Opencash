const sizes: Record<string, number> = { compact: 180, normal: 240, tall: 340, max: 460 };
const key = "opencash.chartsize";

function current(): string {
  try {
    const saved = localStorage.getItem(key);
    if (saved && saved in sizes) return saved;
  } catch {}
  return "normal";
}

function apply(size: string) {
  const height = sizes[size] ?? sizes.normal!;
  document.documentElement.style.setProperty("--chart-h", `${height}px`);
  document.documentElement.style.setProperty("--chart-tall", `${Math.round(height * 1.5)}px`);
  document.querySelectorAll<HTMLSelectElement>("[data-chart-size]").forEach((select) => (select.value = size));
  window.dispatchEvent(new Event("resize"));
}

export function initChartSize() {
  apply(current());
  document.addEventListener("change", (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>("[data-chart-size]");
    if (!select) return;
    try {
      localStorage.setItem(key, select.value);
    } catch {}
    apply(select.value);
  });
}
