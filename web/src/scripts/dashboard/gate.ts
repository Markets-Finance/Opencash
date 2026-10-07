import { isMeraError } from "@category-labs/mera";
import type { TradingAccount } from "shared";
import { createAccount, signIn } from "../mera";
import { avatars, query } from "./dom";
import { session } from "./state";

const gate = query("[data-gate]");
const dash = query("[data-dash]");
const status = query("[data-gate-status]");
const signInButton = query<HTMLButtonElement>("[data-sign-in]");
const createButton = query<HTMLButtonElement>("[data-create]");
const createForm = query<HTMLFormElement>("[data-create-form]");

function say(message: string, tone: "info" | "error" = "info") {
  status.textContent = message;
  status.dataset.tone = tone;
}

function explain(error: unknown): string {
  if (!isMeraError(error)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
  const messages: Record<string, string> = {
    PRF_UNAVAILABLE:
      "This passkey cannot derive keys. Try a passkey stored in iCloud Keychain, Google Password Manager or 1Password.",
    PASSKEY_OPERATION_FAILED: "The passkey prompt was cancelled or unavailable.",
    CRYPTO_UNAVAILABLE: "This browser is missing a required crypto primitive.",
  };
  return messages[error.code] ?? `${error.code}: ${error.message}`;
}

async function paintIdentity(account: TradingAccount) {
  const { avatarDataUri, avatarSeed, shortenAddress } = await avatars();
  const short = shortenAddress(account.address);
  const nameEl = document.querySelector<HTMLElement>("[data-account-name]");
  const addressEl = document.querySelector<HTMLElement>("[data-address-text]");
  const avatarEl = document.querySelector<HTMLImageElement>("[data-account-avatar]");
  const topbarEl = document.querySelector<HTMLElement>("[data-topbar-address-text]");
  if (nameEl) nameEl.textContent = "Trader";
  if (addressEl) addressEl.textContent = short;
  if (topbarEl) topbarEl.textContent = short;
  if (avatarEl) {
    avatarEl.src = avatarDataUri(avatarSeed(account.address, 0));
    avatarEl.alt = `Avatar for ${short}`;
  }
}

export function initGate(onEnter: () => void) {
  async function run(action: () => Promise<TradingAccount>, pending: string) {
    say(pending);
    try {
      const account = await action();
      session.trader = account;
      gate.hidden = true;
      dash.hidden = false;
      await paintIdentity(account);
      onEnter();
    } catch (error) {
      say(explain(error), "error");
    }
  }

  signInButton.addEventListener("click", () => run(signIn, "Waiting for your passkey…"));
  createButton.addEventListener("click", () => {
    createForm.hidden = !createForm.hidden;
    if (!createForm.hidden) createForm.querySelector("input")?.focus();
  });
  createForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(createForm);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    void run(() => createAccount(email, name), "Creating a passkey…");
  });
}
