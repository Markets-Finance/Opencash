import { addressForKey, legacyNotesNamespace, loadVault, notesNamespace, saveVault, tradeKeyRemoveMessage, vaultExists, type NamespaceSession } from "shared";
import { network } from "../../data/network";
import { avatars, errorText, query } from "./dom";
import { openDeleteAccount } from "./deleteAccount";
import { clearImport, importWallet, openNamespace } from "../mera";
import { initIdentity } from "./identity";
import { disconnect } from "./tabs";
import { autoFundOn, setAutoFund } from "./autoFund";
import { initShareCard } from "./shareCard";
import { requireTrader } from "./state";

type Profile = { name: string; email: string; variant?: number };

const profileKey = "opencash.profile";

export function initAccount() {
  const trader = requireTrader();
  const nameInput = query<HTMLInputElement>("[data-profile-name]");
  const emailInput = query<HTMLInputElement>("[data-profile-email]");
  const status = query("[data-account-status]");
  let variant = 0;

  function loadProfile(): Profile | null {
    const raw = localStorage.getItem(profileKey);
    if (raw === null) return null;
    try {
      return JSON.parse(trader.openProfile(JSON.parse(raw)));
    } catch {
      return null;
    }
  }

  function saveProfile(value: Profile) {
    localStorage.setItem(profileKey, JSON.stringify(trader.sealProfile(JSON.stringify(value))));
  }

  async function paint() {
    const { avatarDataUri, avatarSeed, shortenAddress } = await avatars();
    const nameEl = document.querySelector<HTMLElement>("[data-account-name]");
    const emailEl = document.querySelector<HTMLElement>("[data-account-email]");
    const avatarEl = document.querySelector<HTMLImageElement>("[data-account-avatar]");
    const profile = loadProfile();
    variant = profile?.variant ?? 0;
    nameInput.value = profile?.name ?? "";
    emailInput.value = profile?.email ?? "";
    if (nameEl) nameEl.textContent = profile?.name || "Trader";
    if (emailEl) emailEl.textContent = profile?.email ?? "";
    if (avatarEl) {
      avatarEl.src = avatarDataUri(avatarSeed(trader.address, variant));
      avatarEl.alt = `Avatar for ${shortenAddress(trader.address)}`;
    }
  }
  void paint();
  void initIdentity();

  const home = query("[data-acct-home]");
  const panes = Array.from(document.querySelectorAll<HTMLElement>("[data-acct-pane]"));
  function showPage(key: string | null) {
    home.hidden = key !== null;
    panes.forEach((pane) => (pane.hidden = pane.dataset.acctPane !== key));
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll<HTMLButtonElement>("[data-acct-open]").forEach((row) => row.addEventListener("click", () => showPage(row.dataset.acctOpen!)));
  document.querySelectorAll<HTMLButtonElement>("[data-acct-back]").forEach((button) => button.addEventListener("click", () => showPage(null)));
  initImportPane();
  initKeyPane();
  initNotesPane();
  initAutoFund();
  initShareCard();
  document.querySelector("[data-delete-account]")?.addEventListener("click", openDeleteAccount);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !home.offsetParent) showPage(null);
  });
  const addressEl = document.querySelector<HTMLElement>("[data-wallet-address]");
  if (addressEl) addressEl.textContent = trader.address;
  document.querySelector<HTMLButtonElement>("[data-copy-address]")?.addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(trader.address);
    const button = event.currentTarget as HTMLButtonElement;
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = "Copy address"), 1400);
  });

  query<HTMLButtonElement>("[data-save-profile]").addEventListener("click", () => {
    saveProfile({ name: nameInput.value.trim(), email: emailInput.value.trim(), variant });
    status.textContent = "Saved on this device, encrypted with a key only your passkey derives.";
    void paint();
  });
  query<HTMLButtonElement>("[data-shuffle]").addEventListener("click", () => {
    variant = (variant + 1) % 12;
    const profile = loadProfile();
    saveProfile({ name: profile?.name ?? "", email: profile?.email ?? "", variant });
    void paint();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-sign-out]").forEach((button) => button.addEventListener("click", disconnect));

  document.querySelector<HTMLButtonElement>("[data-copy]")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(trader.address);
    const hint = document.querySelector<HTMLElement>("[data-copy-hint]");
    if (hint) {
      hint.textContent = "Copied";
      setTimeout(() => (hint.textContent = "Copy"), 1400);
    }
  });
}

function initImportPane() {
  const trader = requireTrader();
  const state = query("[data-import-state]");
  const keyInput = query<HTMLInputElement>("[data-import-key]");
  const preview = query("[data-import-preview]");
  const go = query<HTMLButtonElement>("[data-import-go]");
  const remove = query<HTMLButtonElement>("[data-import-remove]");
  const status = query("[data-import-status]");
  const say = (text: string, tone = "") => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const imported = trader.source === "imported";
  state.textContent = imported
    ? `You are using the imported wallet ${trader.address}. Your passkey account is ${trader.passkeyAddress}.`
    : `You are using your passkey account ${trader.address}. Nothing is imported.`;
  remove.hidden = !imported;
  keyInput.addEventListener("input", () => {
    const address = addressForKey(keyInput.value);
    preview.textContent = keyInput.value.trim() === "" ? "" : address ? `This key opens ${address}` : "That is not a valid private key.";
  });

  go.addEventListener("click", async () => {
    go.disabled = true;
    try {
      say("Waiting for your passkey…");
      const address = await importWallet(keyInput.value);
      keyInput.value = "";
      preview.textContent = "";
      say(`Imported ${address}. Reloading so you can sign in with it…`);
      setTimeout(() => location.reload(), 1200);
    } catch (error) {
      keyInput.value = "";
      preview.textContent = "";
      say(error instanceof Error ? error.message : String(error), "error");
      go.disabled = false;
    }
  });

  remove.addEventListener("click", async () => {
    remove.disabled = true;
    try {
      await clearImport();
      say("Removed the imported wallet. Reloading…");
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      say(error instanceof Error ? error.message : String(error), "error");
      remove.disabled = false;
    }
  });
}

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";

function initKeyPane() {
  const trader = requireTrader();
  const state = query("[data-key-state]");
  const remove = query<HTMLButtonElement>("[data-key-remove]");
  const status = query("[data-key-status]");

  async function load() {
    try {
      const response = await fetch(`${backend}/bots?owner=${trader.address}&network=${network}`);
      const body = (await response.json()) as { hasKey?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Server ${response.status}`);
      state.textContent = body.hasKey ? `A key is saved for ${network}.` : `No key saved for ${network}.`;
      remove.hidden = !body.hasKey;
    } catch (error) {
      state.textContent = errorText(error);
    }
  }

  remove.addEventListener("click", async () => {
    if (!window.confirm("Remove your Perpl trade key? Bots cannot trade until you save one again.")) return;
    remove.disabled = true;
    status.dataset.tone = "";
    try {
      const issuedAt = Date.now();
      const signature = await trader.account.signMessage({ message: tradeKeyRemoveMessage(trader.address, network, issuedAt) });
      const response = await fetch(`${backend}/bots/key/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: trader.address, network, issuedAt, signature }),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server ${response.status}`);
      status.textContent = "Removed. Revoke it in Perpl's settings too.";
      await load();
    } catch (error) {
      status.dataset.tone = "error";
      status.textContent = errorText(error);
    } finally {
      remove.disabled = false;
    }
  });

  document.querySelector('[data-acct-open="keys"]')?.addEventListener("click", () => void load());
}

function initNotesPane() {
  const trader = requireTrader();
  const text = query<HTMLTextAreaElement>("[data-notes-text]");
  const save = query<HTMLButtonElement>("[data-notes-save]");
  const unlock = query<HTMLButtonElement>("[data-notes-unlock]");
  const status = query("[data-notes-status]");
  let session: NamespaceSession | null = null;
  const say = (message: string, tone = "") => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  async function ensureSession(): Promise<NamespaceSession> {
    session ??= await openNamespace(notesNamespace);
    return session;
  }

  async function check() {
    try {
      const saved = await vaultExists(backend, trader.address, notesNamespace);
      const old = !saved && (await vaultExists(backend, trader.address, legacyNotesNamespace));
      unlock.hidden = !saved && !old;
      text.disabled = saved && session === null;
      say(saved ? "Your notes are locked. Unlock with your passkey to read them." : old ? "Older notes found. Unlock to read them, then save to upgrade the lock." : "Nothing saved yet. Writing and saving asks for your passkey once.");
    } catch (error) {
      say(errorText(error), "error");
    }
  }

  unlock.addEventListener("click", async () => {
    unlock.disabled = true;
    say("Waiting for your passkey…");
    try {
      const saved = await vaultExists(backend, trader.address, notesNamespace);
      if (saved) text.value = (await loadVault(backend, trader, notesNamespace, await ensureSession())) ?? "";
      else text.value = (await loadVault(backend, trader, legacyNotesNamespace)) ?? "";
      text.disabled = false;
      unlock.hidden = true;
      say("Unlocked on this device.");
    } catch (error) {
      say(errorText(error), "error");
    } finally {
      unlock.disabled = false;
    }
  });

  save.addEventListener("click", async () => {
    save.disabled = true;
    say("Waiting for your passkey…");
    try {
      await saveVault(backend, trader, notesNamespace, text.value, await ensureSession());
      text.disabled = false;
      unlock.hidden = true;
      say("Locked and saved. Only your passkey can open it.");
    } catch (error) {
      say(errorText(error), "error");
    } finally {
      save.disabled = false;
    }
  });

  document.querySelector('[data-acct-open="notes"]')?.addEventListener("click", () => void check());
}

function initAutoFund() {
  const toggle = query<HTMLButtonElement>("[data-autofund-toggle]");
  const state = query("[data-autofund-state]");
  const paint = () => (state.textContent = autoFundOn() ? "On" : "Off");
  paint();
  document.addEventListener("autofund:changed", paint);
  toggle.addEventListener("click", () => {
    setAutoFund(!autoFundOn());
    paint();
  });
}
