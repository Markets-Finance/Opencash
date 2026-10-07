import { bins, sizeBinFor, terminal, type Bin, type EntryStep } from "../perpl";
import { errorText, legStackHtml, query, usd } from "./dom";
import { initHome } from "./home";
import { getMarketData, getPositions } from "./market";
import { openModal } from "./modal";
import { requireTrader } from "./state";

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
    card.innerHTML = `
      ${legStackHtml(bin.legs.map((leg) => leg.symbol))}
      <span class="tile-card__name">${bin.name}</span>
      <span class="tile-card__thesis">${bin.thesis}</span>
      <div class="tile-card__legs">
        ${bin.legs.map((leg) => `<div class="tile-leg"><span>${leg.direction === "long" ? "Long" : "Short"} ${leg.symbol}</span><span>${(leg.weightBps / 100).toFixed(0)}%</span></div>`).join("")}
      </div>`;
    card.addEventListener("click", () => openBinModal(bin));
    carousel.appendChild(card);
  }
}

function openBinModal(bin: Bin) {
  const detail = openModal(`
    <div class="modal__head">
      <div class="modal__identity">${legStackHtml(bin.legs.map((leg) => leg.symbol))}<span class="modal__title">${bin.name}</span></div>
      <button type="button" class="modal__close" data-close>×</button>
    </div>
    <p class="quote-line">${bin.thesis}</p>
    <div class="amount-row">
      <span>$</span>
      <input type="number" min="0" step="any" placeholder="0" data-bin-amount />
    </div>
    <button type="button" class="btn btn--primary" data-bin-size>Size this bin</button>
    <div data-bin-sizing></div>
    <p class="status-line" data-bin-status></p>
  `);
  const status = query("[data-bin-status]", detail);
  const sizingEl = query("[data-bin-sizing]", detail);
  const amountInput = query<HTMLInputElement>("[data-bin-amount]", detail);

  function fail(error: unknown) {
    status.dataset.tone = "error";
    status.textContent = errorText(error);
  }

  query<HTMLButtonElement>("[data-bin-size]", detail).addEventListener("click", async () => {
    const amount = Number(amountInput.value);
    if (!(amount > 0)) {
      status.textContent = "Enter an amount greater than 0.";
      status.dataset.tone = "error";
      return;
    }
    status.textContent = "Reading every leg…";
    status.dataset.tone = "";
    sizingEl.innerHTML = "";
    try {
      const data = await getMarketData();
      const { sized, issues } = sizeBinFor(bin, amount, data);
      status.textContent = "";
      const warnings = issues.map((i) => i.detail).join(" · ");
      if (sized.legs.length === 0) {
        sizingEl.innerHTML = `<p class="warn-line">${warnings || "No legs could be sized."}</p>`;
        return;
      }
      sizingEl.innerHTML =
        sized.legs
          .map(
            (leg) =>
              `<div class="leg-row"><span>${leg.leg.direction === "long" ? "Long" : "Short"} ${leg.leg.symbol} · ${leg.leverage}x</span><span>${usd(leg.margin)} margin · ${usd(leg.notional)}</span></div>`,
          )
          .join("") +
        (warnings ? `<p class="warn-line">${warnings}</p>` : "") +
        `<button type="button" class="btn btn--primary" data-bin-confirm style="margin-top:12px">Open bin with my passkey</button>`;
      const confirm = query<HTMLButtonElement>("[data-bin-confirm]", sizingEl);
      confirm.addEventListener("click", async () => {
        confirm.disabled = true;
        status.dataset.tone = "";
        try {
          status.textContent = "Waiting for your passkey…";
          await terminal.openBin(requireTrader(), sized, data, (step) => (status.textContent = stepLabels[step]));
          status.textContent = `Opened ${bin.name}.`;
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
