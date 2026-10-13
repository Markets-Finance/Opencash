const tourKey = "opencash.tour.v1";

type Step = { target: string; tag: string; title: string; body: string };

const steps: Step[] = [
  { target: ".wallet", tag: "Your money", title: "AUSD balance", body: "This is your Perpl margin in AUSD. Deposit from Monad or another chain, and send it out any time." },
  { target: '[data-tab="bins"]', tag: "Bins", title: "Back a theme", body: "Pick a bin like Satoshi's Lovers and open every coin in it with one tap and one transaction." },
  { target: '[data-tab="agent"]', tag: "Strategies", title: "Let rules trade", body: "Test a strategy on real history, then run it as a bot with a stop and a cap you choose." },
  { target: '[data-tab="trade"]', tag: "Trade", title: "Trade directly", body: "Open a long or short on any Perpl market and watch entry, stop and liquidation on the chart." },
  { target: '[data-tab="account"]', tag: "Account", title: "Your passkey account", body: "Profile, private notes, imported wallets and your data controls live here." },
];

const pad = 6;
const cardWidth = 320;

function visible(selector: string): HTMLElement | null {
  const found = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return found.find((el) => el.getClientRects().length > 0) ?? null;
}

export function startTourOnce() {
  try {
    if (localStorage.getItem(tourKey) !== null) return;
  } catch {
    return;
  }
  setTimeout(runTour, 900);
}

function runTour() {
  let index = 0;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;inset:0;z-index:9000;font-family:'DM Sans',system-ui,sans-serif";
  const spot = document.createElement("div");
  spot.style.cssText = "position:absolute;border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,0.68);outline:2px solid #c4f299;transition:all 200ms ease;pointer-events:none";
  const card = document.createElement("div");
  card.style.cssText = `position:absolute;width:${cardWidth}px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:20px;border-radius:20px;background:#c4f299;color:#10210a;box-shadow:0 24px 80px rgba(0,0,0,0.6)`;
  const blocker = document.createElement("div");
  blocker.style.cssText = "position:absolute;inset:0";
  root.append(blocker, spot, card);
  document.body.append(root);

  function close() {
    try {
      localStorage.setItem(tourKey, "done");
    } catch {}
    window.removeEventListener("resize", paint);
    window.removeEventListener("keydown", onKey);
    root.remove();
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape") close();
    else if (event.key === "ArrowRight" || event.key === "Enter") step(1);
    else if (event.key === "ArrowLeft") step(-1);
  }

  function step(delta: number) {
    const next = index + delta;
    if (next >= steps.length) return close();
    index = Math.max(0, next);
    paint();
  }

  function paint() {
    const current = steps[index]!;
    const el = visible(current.target);
    const rect = el?.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect) {
      spot.style.display = "block";
      spot.style.top = `${rect.top - pad}px`;
      spot.style.left = `${rect.left - pad}px`;
      spot.style.width = `${rect.width + pad * 2}px`;
      spot.style.height = `${rect.height + pad * 2}px`;
    } else {
      spot.style.display = "none";
    }
    const width = Math.min(cardWidth, vw - 24);
    let left = rect ? rect.left + rect.width / 2 - width / 2 : vw / 2 - width / 2;
    left = Math.min(Math.max(12, left), vw - width - 12);
    let top = rect ? rect.bottom + 18 : vh / 2 - 100;
    if (top + 220 > vh) top = Math.max(12, (rect ? rect.top : vh / 2) - 240);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    const last = index === steps.length - 1;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.65"><span>${current.tag}</span><span>${index + 1} / ${steps.length}</span></div>
      <h2 style="margin:10px 0 6px;font-size:22px;font-weight:600;letter-spacing:-0.02em">${current.title}</h2>
      <p style="margin:0;font-size:14px;line-height:1.5">${current.body}</p>
      <div style="display:flex;gap:5px;margin:16px 0">${steps.map((_, n) => `<i style="height:4px;flex:1;border-radius:2px;background:${n === index ? "#10210a" : "rgba(16,33,10,0.2)"}"></i>`).join("")}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <button data-tour-skip style="background:none;border:0;padding:8px 0;font:inherit;font-size:13px;color:#10210a;opacity:0.65;cursor:pointer">Skip</button>
        <span style="display:flex;gap:8px">
          ${index > 0 ? '<button data-tour-back style="border:1px solid rgba(16,33,10,0.35);background:none;border-radius:999px;padding:9px 16px;font:inherit;font-size:13px;color:#10210a;cursor:pointer">Back</button>' : ""}
          <button data-tour-next style="border:0;background:#10210a;color:#fff;border-radius:999px;padding:9px 20px;font:inherit;font-size:13px;font-weight:600;cursor:pointer">${last ? "Start trading" : "Next"}</button>
        </span>
      </div>`;
    card.querySelector("[data-tour-skip]")?.addEventListener("click", close);
    card.querySelector("[data-tour-back]")?.addEventListener("click", () => step(-1));
    card.querySelector("[data-tour-next]")?.addEventListener("click", () => step(1));
  }

  window.addEventListener("resize", paint);
  window.addEventListener("keydown", onKey);
  paint();
}
