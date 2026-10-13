import { explorer as networkExplorer, label as networkName } from "../../data/network";
import { intents } from "shared";
import { isAddress } from "viem";
import { terminal } from "../perpl";
import { errorText, esc, query } from "./dom";
import { closeModal, openModal } from "./modal";
import { qrSvg } from "./qr";
import { requireTrader } from "./state";

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const explorer = `${networkExplorer}/tx/`;

const chainNames: Record<string, string> = { eth: "Ethereum", base: "Base", arb: "Arbitrum", op: "Optimism", pol: "Polygon", bsc: "BNB Chain", avax: "Avalanche", sol: "Solana", btc: "Bitcoin", near: "NEAR", ton: "TON", tron: "Tron", xrp: "XRP Ledger", sui: "Sui", doge: "Dogecoin" };
const chainName = (chain: string) => chainNames[chain] ?? chain.toUpperCase();

type Source = intents.FundingSource;
type Destination = intents.IntentsToken;

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function openSend() {
  const trader = requireTrader();
  const panel = openModal(`
    <div class="modal__head"><span class="modal__title">Send</span><button type="button" class="modal__close" data-close>×</button></div>
    <p class="quote-line">Send to any Monad address. Only use the Monad network. Funds sent to a wrong address cannot be recovered. This is ${networkName}.</p>
    <div class="send-sources" data-send-sources></div>
    <label class="field"><span>To address</span><input data-send-to placeholder="0x… any Monad address" autocomplete="off" spellcheck="false" /></label>
    <label class="field"><span>Amount <b data-send-unit></b></span><div class="field-row"><input data-send-amount type="number" min="0" step="any" placeholder="0" /><button type="button" class="btn" data-send-max>Max</button></div></label>
    <button type="button" class="btn btn--primary" data-send-go>Send</button>
    <p class="status-line" data-send-status></p>
  `);
  const kinds = [
    { key: "wallet-ausd", label: "Wallet AUSD", unit: "AUSD" },
    { key: "wallet-mon", label: "Wallet MON", unit: "MON" },
    { key: "perpl", label: "Perpl account", unit: "AUSD" },
  ] as const;
  type Kind = (typeof kinds)[number]["key"];
  const balances: Record<Kind, number | null> = { "wallet-ausd": null, "wallet-mon": null, perpl: null };
  let kind: Kind = "wallet-ausd";
  const sourcesEl = query("[data-send-sources]", panel);
  const toEl = query<HTMLInputElement>("[data-send-to]", panel);
  const amountEl = query<HTMLInputElement>("[data-send-amount]", panel);
  const goEl = query<HTMLButtonElement>("[data-send-go]", panel);
  const statusEl = query("[data-send-status]", panel);
  const unitEl = query("[data-send-unit]", panel);

  function paint() {
    sourcesEl.innerHTML = kinds
      .map((k) => `<button type="button" class="send-source${k.key === kind ? " send-source--on" : ""}" data-kind="${k.key}"><span>${k.label}</span><b>${balances[k.key] === null ? "…" : balances[k.key]!.toLocaleString(undefined, { maximumFractionDigits: 4 })}</b></button>`)
      .join("");
    unitEl.textContent = `(${kinds.find((k) => k.key === kind)!.unit})`;
    const value = Number(amountEl.value) || 0;
    const have = balances[kind];
    goEl.disabled = !isAddress(toEl.value.trim()) || value <= 0 || (have !== null && value > have);
  }
  sourcesEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-kind]");
    if (button) {
      kind = button.dataset.kind as Kind;
      paint();
    }
  });
  toEl.addEventListener("input", paint);
  amountEl.addEventListener("input", paint);
  query("[data-send-max]", panel).addEventListener("click", () => {
    const have = balances[kind] ?? 0;
    amountEl.value = String(Math.max(0, kind === "wallet-mon" ? have - 0.01 : have));
    paint();
  });

  async function load() {
    const [ausd, mon, account] = await Promise.all([
      terminal.loadCollateralBalance(trader.address).catch(() => null),
      terminal.loadNativeBalance(trader.address).catch(() => null),
      terminal.loadAccount(trader.address).catch(() => null),
    ]);
    balances["wallet-ausd"] = ausd;
    balances["wallet-mon"] = mon;
    balances.perpl = account?.balance ?? 0;
    paint();
  }
  void load();
  paint();

  goEl.addEventListener("click", async () => {
    const to = toEl.value.trim();
    const amount = Number(amountEl.value);
    goEl.disabled = true;
    statusEl.dataset.tone = "";
    statusEl.textContent = "Waiting for your passkey…";
    try {
      const hash =
        kind === "perpl"
          ? await terminal.withdrawFromPerpl(trader, { to, amount }, (step) => (statusEl.textContent = step === "withdraw" ? "Withdrawn from Perpl. Sending…" : "Sent."))
          : await terminal.sendAsset(trader, { asset: kind === "wallet-mon" ? "MON" : "AUSD", to, amount });
      statusEl.innerHTML = `Sent ${amount} ${kinds.find((k) => k.key === kind)!.unit} to ${esc(short(to))}. <a href="${explorer}${hash}" target="_blank" rel="noreferrer">View transaction ↗</a>`;
      amountEl.value = "";
      void load();
    } catch (error) {
      statusEl.dataset.tone = "error";
      statusEl.textContent = errorText(error);
    } finally {
      paint();
    }
  });
}

function openMove() {
  const trader = requireTrader();
  const panel = openModal(`
    <div class="modal__head"><span class="modal__title">Move between wallet and Perpl</span><button type="button" class="modal__close" data-close>×</button></div>
    <p class="quote-line">Your wallet holds AUSD. Your Perpl account holds the AUSD you trade with. Both belong to ${esc(short(trader.address))}.</p>
    <div class="send-sources" data-move-ways></div>
    <label class="field"><span>Amount <b>(AUSD)</b></span><div class="field-row"><input data-move-amount type="number" min="0" step="any" placeholder="0" /><button type="button" class="btn" data-move-max>Max</button></div></label>
    <button type="button" class="btn btn--primary" data-move-go>Move</button>
    <p class="status-line" data-move-status></p>
  `);
  const ways = [
    { key: "in", label: "Wallet → Perpl" },
    { key: "out", label: "Perpl → Wallet" },
  ] as const;
  type Way = (typeof ways)[number]["key"];
  const balances: Record<Way, number | null> = { in: null, out: null };
  let way: Way = "in";
  const waysEl = query("[data-move-ways]", panel);
  const amountEl = query<HTMLInputElement>("[data-move-amount]", panel);
  const goEl = query<HTMLButtonElement>("[data-move-go]", panel);
  const statusEl = query("[data-move-status]", panel);

  function paint() {
    waysEl.innerHTML = ways
      .map((w) => `<button type="button" class="send-source${w.key === way ? " send-source--on" : ""}" data-way="${w.key}"><span>${w.label}</span><b>${balances[w.key] === null ? "…" : balances[w.key]!.toLocaleString(undefined, { maximumFractionDigits: 4 })}</b></button>`)
      .join("");
    const value = Number(amountEl.value) || 0;
    const have = balances[way];
    goEl.disabled = value <= 0 || (have !== null && value > have);
  }
  waysEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-way]");
    if (button) {
      way = button.dataset.way as Way;
      paint();
    }
  });
  amountEl.addEventListener("input", paint);
  query("[data-move-max]", panel).addEventListener("click", () => {
    amountEl.value = String(balances[way] ?? 0);
    paint();
  });

  async function load() {
    const [ausd, account] = await Promise.all([
      terminal.loadCollateralBalance(trader.address).catch(() => null),
      terminal.loadAccount(trader.address).catch(() => null),
    ]);
    balances.in = ausd;
    balances.out = account?.balance ?? 0;
    paint();
  }
  void load();
  paint();

  goEl.addEventListener("click", async () => {
    const amount = Number(amountEl.value);
    goEl.disabled = true;
    statusEl.dataset.tone = "";
    statusEl.textContent = "Waiting for your passkey…";
    try {
      const hash =
        way === "in"
          ? await terminal.depositToPerpl(trader, amount, (step) => (statusEl.textContent = step === "approve" ? "Approved. Depositing…" : "Deposited."))
          : await terminal.withdrawToWallet(trader, amount);
      statusEl.innerHTML = `Moved ${amount} AUSD ${way === "in" ? "to Perpl" : "to your wallet"}. <a href="${explorer}${hash}" target="_blank" rel="noreferrer">View transaction ↗</a>`;
      amountEl.value = "";
      void load();
    } catch (error) {
      statusEl.dataset.tone = "error";
      statusEl.textContent = errorText(error);
    } finally {
      paint();
    }
  });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backend}${path}`, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

function openDeposit() {
  const trader = requireTrader();
  const panel = openModal(`
    <div class="modal__head"><span class="modal__title">Deposit</span><button type="button" class="modal__close" data-close>×</button></div>
    <div class="switcher switcher--tight" data-dep-tabs>
      <button type="button" data-dep="monad" aria-pressed="true"><i class="switcher__dot switcher__dot--butter"></i>From Monad</button>
      <button type="button" data-dep="chain" aria-pressed="false"><i class="switcher__dot switcher__dot--violet"></i>Another chain</button>
    </div>
    <div data-dep-pane="monad">
      <div class="qr-wrap">${qrSvg(trader.address)}</div>
      <p class="account-address">${esc(trader.address)}</p>
      <button type="button" class="btn" data-dep-copy>Copy address</button>
      <p class="quote-line">Send only on the Monad network. USDC, USDT0, AUSD and MON are fine. Perpl trades in AUSD, so USDC and USDT0 are converted to AUSD in the app before they become margin.</p>
      <p class="quote-line" data-dep-gas>Keep about $0.50 of MON in this address to pay network fees.</p>
    </div>
    <div data-dep-pane="chain" hidden>
      <p class="status-line" data-dep-provider></p>
      <div class="field-row">
        <label class="field"><span>You pay</span><select data-dep-token></select></label>
        <label class="field"><span>Amount</span><input type="number" min="0" step="any" value="100" data-dep-amount /></label>
      </div>
      <div class="field-row">
        <label class="field"><span>You get on Monad</span><select data-dep-dest></select></label>
        <label class="field" data-dep-refund-wrap hidden><span>Refund address</span><input data-dep-refund placeholder="Address on the source chain" /></label>
      </div>
      <div class="dep-quote" data-dep-quote><p class="empty">Loading…</p></div>
      <button type="button" class="btn btn--primary" data-dep-go disabled>Get my deposit address</button>
      <div data-dep-result></div>
      <p class="quote-line">Aurora brings it to Monad as USDC in your OpenCash address, usually in under a minute. The app then converts it to AUSD for Perpl margin.</p>
    </div>
  `);
  const tabs = panel.querySelectorAll<HTMLElement>("[data-dep]");
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
      panel.querySelectorAll<HTMLElement>("[data-dep-pane]").forEach((pane) => (pane.hidden = pane.dataset.depPane !== tab.dataset.dep));
    }),
  );
  query("[data-dep-copy]", panel).addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(trader.address);
    const button = event.currentTarget as HTMLButtonElement;
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = "Copy address"), 1400);
  });

  const tokenEl = query<HTMLSelectElement>("[data-dep-token]", panel);
  const destEl = query<HTMLSelectElement>("[data-dep-dest]", panel);
  const amountEl = query<HTMLInputElement>("[data-dep-amount]", panel);
  const refundWrap = query("[data-dep-refund-wrap]", panel);
  const refundEl = query<HTMLInputElement>("[data-dep-refund]", panel);
  const quoteEl = query("[data-dep-quote]", panel);
  const goEl = query<HTMLButtonElement>("[data-dep-go]", panel);
  const resultEl = query("[data-dep-result]", panel);
  let sources: Source[] = [];
  let destinations: Destination[] = [];
  let persistent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let quoteOk = false;

  const selected = () => sources.find((s) => s.assetId === tokenEl.value);
  const target = () => destinations.find((d) => d.assetId === destEl.value);

  async function quote() {
    const origin = selected();
    const destination = target();
    const amount = Number(amountEl.value);
    goEl.disabled = true;
    quoteOk = false;
    if (!origin || !destination || !(amount > 0)) return;
    const evm = intents.isEvmChain(origin.blockchain);
    refundWrap.hidden = evm;
    const refundTo = evm ? trader.address : refundEl.value.trim();
    if (!evm && refundTo.length < 8) {
      quoteEl.innerHTML = `<p class="empty">Enter your ${esc(chainName(origin.blockchain))} address so a failed deposit can be refunded.</p>`;
      return;
    }
    quoteEl.innerHTML = `<p class="empty">Getting a live quote…</p>`;
    try {
      const { quote: q } = await api<{ quote: intents.Quote }>("/intents/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originAsset: origin.assetId, destinationAsset: destination.assetId, amount: intents.toBaseUnits(amount, origin.decimals), recipient: trader.address, refundTo, dry: true }),
      });
      const cost = intents.costBps(q);
      quoteEl.innerHTML = `<div class="stat-grid"><div class="stat"><small>You get</small><b>${Number(q.amountOutFormatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${esc(destination.symbol)}</b></div><div class="stat"><small>Cost</small><b>${cost === null ? "—" : `${(cost / 100).toFixed(2)}%`}</b></div><div class="stat"><small>Arrives in</small><b>about ${q.timeEstimate}s</b></div><div class="stat"><small>At least</small><b>${(Number(q.minAmountOut) / 10 ** destination.decimals).toLocaleString(undefined, { maximumFractionDigits: 4 })}</b></div></div>`;
      quoteOk = true;
      goEl.disabled = !persistent;
    } catch (error) {
      quoteEl.innerHTML = `<p class="status-line" data-tone="error">${esc(errorText(error))}</p>`;
    }
  }
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void quote(), 500);
  };
  [tokenEl, destEl].forEach((el) => el.addEventListener("change", later));
  amountEl.addEventListener("input", later);
  refundEl.addEventListener("input", later);

  goEl.addEventListener("click", async () => {
    const origin = selected();
    if (!origin || !quoteOk) return;
    goEl.disabled = true;
    resultEl.innerHTML = "";
    const evm = intents.isEvmChain(origin.blockchain);
    try {
      const address = await api<{ kind: string; depositAddress: string; memo?: string; deadline?: string; amountIn?: string; amountOut?: string }>("/intents/deposit-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: origin.blockchain, asset: target()?.symbol === "MON" ? "mon" : "usdc", recipient: trader.address, originAsset: origin.assetId, amount: intents.toBaseUnits(Number(amountEl.value), origin.decimals), refundTo: evm ? trader.address : refundEl.value.trim() }),
      });
      resultEl.innerHTML = `<div class="qr-wrap">${qrSvg(address.depositAddress, 160)}</div><p class="account-address">${esc(address.depositAddress)}</p>${address.memo ? `<p class="status-line" data-tone="error">Memo required: ${esc(address.memo)}</p>` : ""}<p class="quote-line">${address.kind === "persistent" ? "This address is yours and stays the same. Send any supported token any time." : `One-time address. Send exactly ${esc(address.amountIn ?? "")} ${esc(origin.symbol)}${address.deadline ? ` before ${esc(new Date(address.deadline).toLocaleTimeString())}` : ""}.`}</p>`;
    } catch (error) {
      resultEl.innerHTML = `<p class="status-line" data-tone="error">${esc(errorText(error))}</p>`;
    } finally {
      goEl.disabled = false;
    }
  });

  void terminal
    .loadNativeBalance(trader.address)
    .then((mon) => {
      if (mon < 0.05) query("[data-dep-gas]", panel).textContent = "This address has almost no MON for network fees. Send about $0.50 of MON here, or pick MON under “You get on Monad” on the Another chain tab.";
    })
    .catch(() => {});

  void (async () => {
    try {
      const [info, catalog] = await Promise.all([api<{ provider: string; persistent: boolean }>("/intents/info"), api<{ sources: Source[]; destinations: Destination[] }>("/intents/tokens")]);
      persistent = info.persistent;
      sources = catalog.sources;
      destinations = catalog.destinations;
      query("[data-dep-provider]", panel).textContent = info.provider === "aurora" ? "Powered by Aurora Intents" : "No Aurora key set, quotes only";
      tokenEl.innerHTML = sources.map((s) => `<option value="${esc(s.assetId)}">${esc(s.symbol)} · ${esc(chainName(s.blockchain))}</option>`).join("");
      destEl.innerHTML = destinations.map((d) => `<option value="${esc(d.assetId)}">${esc(d.symbol)}</option>`).join("");
      const preferred = sources.find((s) => s.blockchain === "eth" && s.symbol === "USDC");
      if (preferred) tokenEl.value = preferred.assetId;
      const usdc = destinations.find((d) => d.symbol === "USDC");
      if (usdc) destEl.value = usdc.assetId;
      void quote();
    } catch (error) {
      quoteEl.innerHTML = `<p class="status-line" data-tone="error">${esc(errorText(error))}. Start the backend and try again.</p>`;
    }
  })();
}

export function initFunds() {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-open-deposit]")) openDeposit();
    if (target.closest("[data-open-send]")) openSend();
    if (target.closest("[data-open-move]")) openMove();
  });
}

export { closeModal };
