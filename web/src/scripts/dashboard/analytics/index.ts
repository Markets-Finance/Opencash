import { errorText, query } from "../dom";
import { ago } from "./format";
import { initProtocolControls, paintProtocol, type Protocol } from "./protocol";
import { initWallet, lookup, setNetwork } from "./wallet";

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";
let network = "mainnet";
let updatedAt = 0;
let timer: ReturnType<typeof setInterval> | undefined;

async function load() {
  const live = query("[data-an-live]");
  try {
    const response = await fetch(`${backend}/analytics/protocol?network=${network}`);
    const body = (await response.json()) as Protocol & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `Analytics ${response.status}`);
    paintProtocol(body);
    updatedAt = body.at;
    live.classList.remove("live--off");
  } catch (error) {
    live.classList.add("live--off");
    query("[data-an-headline]").innerHTML = `<p class="status-line" data-tone="error">${errorText(error)}. Is the backend running?</p>`;
  }
}

function tick() {
  const label = query("[data-an-live] span");
  label.textContent = updatedAt === 0 ? "Connecting…" : `Live · updated ${ago(updatedAt)}`;
}

export function initAnalytics() {
  initProtocolControls();
  initWallet(backend, () => network);
  void load();
  timer = setInterval(() => {
    tick();
    if (!document.hidden && Date.now() - updatedAt > 30_000) void load();
  }, 1000);

  query("[data-an-net]", document).parentElement!.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-an-net]");
    if (!button || button.dataset.anNet === network) return;
    network = button.dataset.anNet!;
    button.parentElement!.querySelectorAll("[data-an-net]").forEach((el) => el.setAttribute("aria-pressed", String(el === button)));
    updatedAt = 0;
    setNetwork(network);
    void load();
  });

  document.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-an-lookup]");
    if (!target) return;
    const switcher = document.querySelector<HTMLElement>('[data-switcher="an"] [data-switch="wallet"]');
    switcher?.click();
    void lookup(target.dataset.anLookup!);
  });
  void timer;
}
