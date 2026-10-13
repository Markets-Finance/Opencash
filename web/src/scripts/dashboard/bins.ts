import { customBin, planBin, weightModes, type WeightMode } from "shared";
import { bins, cardFromBin, terminal, type Bin, type EntryStep } from "../perpl";
import { toolbox } from "./agent/session";
import { binPulse, flowText, loadPulses, stanceText } from "./nansen";
import { setCard } from "./agent/card";
import { errorText, legStackHtml, query, usd } from "./dom";
import { initHome } from "./home";
import { getMarketData, getPositions } from "./market";
import { closeModal, openModal } from "./modal";
import { requireTrader } from "./state";
import { activateTab } from "./tabs";
import { openAsset } from "./trade";

const stepLabels: Record<EntryStep, string> = {
  approve: "Approving AUSD…",
  fund: "Funding the account…",
  orders: "Opening every leg…",
};

export function initBins() {
  const carousel = query("[data-bins-carousel]");
  carousel.className = "carousel";
  carousel.innerHTML = "";
  for (const bin of bins) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "tile-card";
    card.dataset.binId = bin.id;
    card.innerHTML = `
      ${legStackHtml(bin.legs.map((leg) => leg.symbol))}
      <span class="tile-card__name">${bin.name}</span>
      <span class="tile-card__thesis">${bin.thesis}</span>
      <div class="tile-card__legs">
        ${bin.legs.map((leg) => `<div class="tile-leg asset-row--link" data-open-asset="${leg.symbol}" title="Trade ${leg.symbol}"><span>${leg.direction === "long" ? "Long" : "Short"} ${leg.symbol}</span><span>${(leg.weightBps / 100).toFixed(0)}%</span></div>`).join("")}
      </div>`;
    card.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-open-asset]")) return;
      openBinModal(bin);
    });
    carousel.appendChild(card);
  }
  const build = document.createElement("button");
  build.type = "button";
  build.className = "tile-card";
  build.innerHTML = `
    <div class="leg-stack"><span class="tile-plus">+</span></div>
    <span class="tile-card__name">Build your own</span>
    <span class="tile-card__thesis">${customBase.thesis}</span>
    <div class="tile-card__legs"><div class="tile-leg"><span>Pick assets</span><span>+</span></div></div>`;
  build.addEventListener("click", () => openBinModal(customBase, true));
  carousel.appendChild(build);
  void paintPulses(carousel);
}

async function paintPulses(carousel: HTMLElement) {
  const pulses = await loadPulses(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)));
  if (!pulses) return;
  carousel.querySelectorAll<HTMLElement>("[data-bin-id]").forEach((card) => {
    const bin = bins.find((item) => item.id === card.dataset.binId);
    if (!bin) return;
    const agreement = binPulse(bin.legs, pulses);
    const tone = agreement.agree === agreement.total ? "agree" : agreement.against > agreement.agree ? "against" : "mixed";
    card.insertAdjacentHTML("beforeend", `<span class="tile-pulse tile-pulse--${tone}" title="Nansen smart-money net flow, 7 days">${agreement.label}</span>`);
  });
}

const customBase: Bin = { id: "custom", name: "Build your own", thesis: "Pick assets and directions, then choose how margin is split.", legs: [] };

function openBinModal(bin: Bin, custom = false) {
  let mode: WeightMode = bin.mode ?? "fixed";
  const picks = new Map<string, "long" | "short">();
  const detail = openModal(`
    <div class="modal__head">
      <div class="modal__identity">${legStackHtml(bin.legs.map((leg) => leg.symbol))}<span class="modal__title">${bin.name}</span></div>
      <button type="button" class="modal__close" data-close>×</button>
    </div>
    <p class="quote-line">${bin.thesis}</p>
    ${custom ? `<div class="pick-grid" data-bin-picks>Loading markets…</div>` : ""}
    <div class="pulse-table" data-bin-pulse></div>
    <div class="chip-row" data-bin-modes>${weightModes.map((m) => `<button type="button" class="chip${m.key === mode ? " chip--active" : ""}" data-mode="${m.key}" title="${m.hint}">${m.label}</button>`).join("")}</div>
    <div class="amount-row">
      <span>$</span>
      <input type="number" min="0" step="any" placeholder="0" data-bin-amount />
    </div>
    <button type="button" class="btn btn--primary" data-bin-size>Trade this bin</button>
    <div data-bin-sizing></div>
    <div class="btn-row">
      <button type="button" class="btn" data-bin-agent>Build a bot from this bin</button>
    </div>
    <p class="status-line" data-bin-status></p>
  `);
  const status = query("[data-bin-status]", detail);
  const sizingEl = query("[data-bin-sizing]", detail);
  const amountInput = query<HTMLInputElement>("[data-bin-amount]", detail);

  function fail(error: unknown) {
    status.dataset.tone = "error";
    status.textContent = errorText(error);
  }

  async function paintModalPulse(symbols: string[]) {
    const holder = query("[data-bin-pulse]", detail);
    if (symbols.length === 0) {
      holder.innerHTML = "";
      return;
    }
    const pulses = await loadPulses(symbols);
    if (!pulses) {
      holder.innerHTML = "";
      return;
    }
    holder.innerHTML =
      `<span class="pulse-table__title">Smart money, 7 days (Nansen)</span>` +
      symbols
        .map((symbol) => pulses.get(symbol.toUpperCase()))
        .filter((pulse): pulse is NonNullable<typeof pulse> => pulse !== undefined && pulse.tokens.length > 0)
        .map((pulse) => `<div class="pulse-row"><b>${pulse.symbol}</b><span class="pulse-chip pulse-chip--${pulse.stance}">${stanceText(pulse.stance)}</span><span>${flowText(pulse.flow7dUsd)}</span><small>${pulse.traders} traders</small></div>`)
        .join("");
  }
  void paintModalPulse(bin.legs.map((leg) => leg.symbol));

  detail.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      mode = button.dataset.mode as WeightMode;
      detail.querySelectorAll<HTMLElement>("[data-mode]").forEach((el) => el.classList.toggle("chip--active", el === button));
    }),
  );

  if (custom) {
    void getMarketData().then((data) => {
      const grid = query("[data-bin-picks]", detail);
      const symbols = [...data.markets.values()].filter((m) => m.numOrders > 0).map((m) => m.symbol);
      grid.innerHTML = symbols
        .map((symbol) => `<div class="pick"><b>${symbol}</b><button type="button" class="chip" data-pick="${symbol}:long">Long</button><button type="button" class="chip" data-pick="${symbol}:short">Short</button></div>`)
        .join("");
      grid.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>("[data-pick]");
        if (!button) return;
        const [symbol, direction] = button.dataset.pick!.split(":") as [string, "long" | "short"];
        if (picks.get(symbol) === direction) picks.delete(symbol);
        else picks.set(symbol, direction);
        void paintModalPulse([...picks.keys()]);
        grid.querySelectorAll<HTMLElement>(`[data-pick^="${symbol}:"]`).forEach((el) =>
          el.classList.toggle("chip--active", picks.get(symbol) === el.dataset.pick!.split(":")[1]),
        );
      });
    });
  }

  function activeBin(): Bin | null {
    if (!custom) return bin;
    if (picks.size === 0) return null;
    return customBin([...picks].map(([symbol, direction]) => ({ symbol, direction })), mode, 3);
  }

  const binCard = () => cardFromBin(activeBin() ?? bin, Number(amountInput.value) > 0 ? Number(amountInput.value) : 100, 10);

  query<HTMLButtonElement>("[data-bin-agent]", detail).addEventListener("click", () => {
    closeModal();
    activateTab("agent");
    setCard(binCard());
  });

  query<HTMLButtonElement>("[data-bin-size]", detail).addEventListener("click", async () => {
    const amount = Number(amountInput.value);
    if (!(amount > 0)) {
      status.textContent = "Enter an amount greater than 0.";
      status.dataset.tone = "error";
      return;
    }
    const chosen = activeBin();
    if (chosen === null) {
      status.textContent = "Pick at least one asset.";
      status.dataset.tone = "error";
      return;
    }
    status.textContent = "Reading every market…";
    status.dataset.tone = "";
    sizingEl.innerHTML = "";
    try {
      const data = await getMarketData();
      const { sized, issues, usedMode } = await planBin(toolbox, chosen, amount, data, mode);
      status.textContent = "";
      const warnings = issues.map((i) => i.detail).join(" · ");
      const incomplete = sized.legs.length < chosen.legs.length;
      const minimums = chosen.legs.map((leg) => {
        const market = data.markets.get(leg.symbol);
        if (!market) return null;
        const leverage = Math.min(leg.leverage, data.maxLeverage.get(leg.symbol) ?? leg.leverage);
        return (market.mark / 10 ** market.lotDecimals / leverage / (leg.weightBps / 10000)) * 1.15;
      });
      const needs = minimums.some((value) => value === null)
        ? "A leg is not available right now."
        : `Needs at least ${usd(Math.ceil(Math.max(...(minimums as number[]))))} for every leg.`;
      const fellBack = usedMode !== mode ? `<p class="warn-line">Not enough data for ${mode} weights, using fixed.</p>` : "";
      if (sized.legs.length === 0) {
        sizingEl.innerHTML = `<p class="warn-line">${warnings || "No legs could be sized."}</p>`;
        return;
      }
      sizingEl.innerHTML =
        sized.legs
          .map(
            (leg) =>
              `<div class="leg-row"><span>${leg.leg.direction === "long" ? "Long" : "Short"} ${leg.leg.symbol} · ${leg.leverage}x · ${(leg.leg.weightBps / 100).toFixed(1)}%</span><span>${usd(leg.margin)} margin · ${usd(leg.notional)}</span></div>`,
          )
          .join("") +
        fellBack +
        (warnings ? `<p class="warn-line">${warnings}</p>` : "") +
        (incomplete
          ? `<p class="warn-line">${needs}</p>`
          : `<button type="button" class="btn btn--primary" data-bin-confirm style="margin-top:12px">Confirm and trade with my passkey</button>`);
      if (incomplete) return;
      const confirm = query<HTMLButtonElement>("[data-bin-confirm]", sizingEl);
      confirm.addEventListener("click", async () => {
        confirm.disabled = true;
        status.dataset.tone = "";
        try {
          status.textContent = "Waiting for your passkey…";
          await terminal.openBin(requireTrader(), sized, data, (step) => (status.textContent = stepLabels[step]));
          status.textContent = `Opened ${bin.name}. Manage each leg below, or from Trade.`;
          sizingEl.innerHTML = sized.legs
            .map((leg) => `<button type="button" class="btn" data-manage="${leg.leg.symbol}" style="margin-top:8px">${leg.leg.symbol} · Manage ↗</button>`)
            .join("");
          sizingEl.querySelectorAll<HTMLButtonElement>("[data-manage]").forEach((button) =>
            button.addEventListener("click", () => {
              closeModal();
              openAsset(button.dataset.manage!);
            }),
          );
          await getPositions(true);
          void initHome();
        } catch (error) {
          fail(error);
          confirm.disabled = false;
        }
      });
    } catch (error) {
      fail(error);
    }
  });
}
