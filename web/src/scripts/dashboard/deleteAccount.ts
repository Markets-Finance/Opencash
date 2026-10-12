import { deleteAccountMessage } from "shared";
import { network } from "../../data/network";
import { clearImport } from "../mera";
import { terminal } from "../perpl";
import { errorText, query } from "./dom";
import { closeModal, openModal } from "./modal";
import { requireTrader } from "./state";

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const confirmWord = "DELETE";

async function blockers(): Promise<string[]> {
  const trader = requireTrader();
  const [open, live, bots] = await Promise.all([
    terminal.loadMarkets().then((data) => terminal.loadOpenPositions(trader.address, data)),
    fetch(`${backend}/live?owner=${trader.address}&network=${network}`).then((r) => r.json() as Promise<{ bots: { enabled: boolean }[] }>),
    fetch(`${backend}/bots?owner=${trader.address}&network=${network}`).then((r) => r.json() as Promise<{ bots?: { enabled: boolean }[] }>),
  ]);
  const running = live.bots.filter((b) => b.enabled).length + (bots.bots ?? []).filter((b) => b.enabled).length;
  const list: string[] = [];
  if (open.length > 0) list.push(`You have ${open.length} open position${open.length === 1 ? "" : "s"} on Perpl. Close ${open.length === 1 ? "it" : "them"} first.`);
  if (running > 0) list.push(`${running} bot${running === 1 ? " is" : "s are"} running. Pause ${running === 1 ? "it" : "them"} from the Bots tab first.`);
  return list;
}

export function openDeleteAccount() {
  const trader = requireTrader();
  const panel = openModal(`
    <div class="modal__head"><span class="modal__title">Delete my data?</span><button type="button" class="modal__close" data-close>×</button></div>
    <div class="warn-box"><b>This cannot be undone.</b> Read this before you continue.
      <ul>
        <li>Your saved Perpl trade key is removed from our server, so no bot can trade for you.</li>
        <li>Your bots, live strategies, boards, portfolio history, shared strategies, follow records and X link are deleted from our server. Strategies you shared disappear for everyone who followed them.</li>
        <li>The imported wallet, your profile and everything else saved on this device are wiped, and you are signed out.</li>
      </ul>
    </div>
    <div class="warn-box"><b>What this does not do.</b>
      <ul>
        <li>Your wallet and your Perpl account stay on Monad with their funds. Move or send them out first if you want them elsewhere.</li>
        <li>The Perpl API key itself still exists at Perpl. Revoke it in Perpl's settings.</li>
        <li>Your passkey stays in your password manager. Delete it there yourself. If you delete it while the account still holds funds, you will lose access to them.</li>
      </ul>
    </div>
    <p class="quote-line">Account: ${trader.address}${trader.source === "imported" ? " (imported wallet)" : ""}</p>
    <div data-delete-blockers><p class="empty">Checking for open positions and running bots…</p></div>
    <label class="field"><span>Type ${confirmWord} to confirm</span><input data-delete-word autocomplete="off" spellcheck="false" /></label>
    <label class="quote-line"><input type="checkbox" data-delete-ack /> I understand this cannot be undone.</label>
    <div class="btn-row">
      <button type="button" class="btn" data-delete-cancel>Cancel</button>
      <button type="button" class="btn btn--danger" data-delete-go disabled>Delete my data</button>
    </div>
    <p class="status-line" data-delete-status></p>
  `);
  const blockersEl = query("[data-delete-blockers]", panel);
  const wordEl = query<HTMLInputElement>("[data-delete-word]", panel);
  const ackEl = query<HTMLInputElement>("[data-delete-ack]", panel);
  const goEl = query<HTMLButtonElement>("[data-delete-go]", panel);
  const statusEl = query("[data-delete-status]", panel);
  let blocked = true;
  let running = false;

  function paint() {
    goEl.disabled = running || blocked || wordEl.value.trim() !== confirmWord || !ackEl.checked;
  }
  wordEl.addEventListener("input", paint);
  ackEl.addEventListener("change", paint);
  query("[data-delete-cancel]", panel).addEventListener("click", closeModal);

  void blockers()
    .then((list) => {
      blocked = list.length > 0;
      blockersEl.innerHTML = blocked ? `<div class="warn-box"><b>Not yet.</b><ul>${list.map((text) => `<li>${text}</li>`).join("")}</ul></div>` : `<p class="quote-line">No open positions or running bots. You can continue.</p>`;
      paint();
    })
    .catch((error) => {
      blockersEl.innerHTML = `<p class="status-line" data-tone="error">${errorText(error)}. Deleting is disabled until this check works.</p>`;
    });

  goEl.addEventListener("click", async () => {
    running = true;
    paint();
    statusEl.dataset.tone = "";
    try {
      statusEl.textContent = "Deleting your data on our server…";
      const issuedAt = Date.now();
      const signature = await trader.account.signMessage({ message: deleteAccountMessage(trader.address, issuedAt) });
      const response = await fetch(`${backend}/account/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: trader.address, issuedAt, signature }),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server ${response.status}`);
      statusEl.textContent = "Wiping this device…";
      await clearImport();
      for (const key of Object.keys(localStorage)) if (key.startsWith("opencash.")) localStorage.removeItem(key);
      sessionStorage.clear();
      statusEl.textContent = "Done. Everything is deleted. Signing you out…";
      setTimeout(() => location.reload(), 1800);
    } catch (error) {
      running = false;
      statusEl.dataset.tone = "error";
      statusEl.textContent = `Stopped: ${errorText(error)}. Nothing on this device was wiped.`;
      paint();
    }
  });
}
