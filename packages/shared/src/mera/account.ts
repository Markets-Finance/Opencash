import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
  type PasskeyCredentialMetadata,
  type WebAuthnClient,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import {
  deriveNamespaceKey,
  open as openSealed,
  seal as sealPlaintext,
  type SealedRecord,
} from "./namespace.js";
import { isDevAuth } from "./config.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8 } from "@scure/base";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { LocalAccount } from "viem";

const evmAccountPath = "m/44'/60'/0'/0/0";

const devEntropy = sha256(utf8.decode("opencash.dev.account.v1"));

function devTradingAccount(): TradingAccount {
  return deriveTradingAccount(Uint8Array.from(devEntropy));
}

export const profileNamespace = "terminal.profile.v1";

export type CredentialStore = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
};

export type PasskeyContext = {
  rpId: string;
  rpName: string;
  store: CredentialStore;
  webAuthnClient?: WebAuthnClient;
};

export type TradingAccount = {
  address: `0x${string}`;
  account: LocalAccount<"mera">;
  sealProfile(plaintext: string): SealedRecord;
  openProfile(record: SealedRecord): string;
  end(): void;
};

function deriveTradingAccount(prfOutput: Uint8Array): TradingAccount {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(evmAccountPath);
  if (node.privateKey === null) throw new Error("derivation produced no key");

  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  const profileKey = deriveNamespaceKey(prfOutput, profileNamespace);

  seed.fill(0);
  node.wipePrivateData();
  prfOutput.fill(0);

  return {
    address: getEvmAddress(session.publicKey),
    account: toViemAccount(session),
    sealProfile: (plaintext) =>
      sealPlaintext(profileKey, profileNamespace, plaintext),
    openProfile: (record) => openSealed(profileKey, record),
    end: () => {
      profileKey.fill(0);
      session.end();
    },
  };
}

export async function createTradingAccount(
  context: PasskeyContext & { userName: string; displayName: string },
): Promise<TradingAccount> {
  if (isDevAuth) return devTradingAccount();

  const created = await createPasskeyWithPrfOutput({
    rp: { id: context.rpId, name: context.rpName },
    user: { name: context.userName, displayName: context.displayName },
    webAuthnClient: context.webAuthnClient,
  });

  await context.store.write(
    JSON.stringify({
      credentialId: created.credentialId,
      transports: created.transports,
    }),
  );

  return deriveTradingAccount(created.prfOutput);
}

async function readCredential(
  context: PasskeyContext,
): Promise<PasskeyCredentialMetadata | undefined> {
  const stored = await context.store.read();
  return stored === null ? undefined : JSON.parse(stored);
}

export async function signInTradingAccount(
  context: PasskeyContext,
): Promise<TradingAccount> {
  if (isDevAuth) return devTradingAccount();

  const known = await readCredential(context);

  const { prfOutput, credentialId } = await getPasskeyPrfOutput({
    rpId: context.rpId,
    credential: known,
    webAuthnClient: context.webAuthnClient,
  });

  if (known?.credentialId !== credentialId) {
    await context.store.write(JSON.stringify({ credentialId }));
  }

  return deriveTradingAccount(prfOutput);
}

export async function revealRecoveryPhrase(
  context: PasskeyContext,
): Promise<string> {
  if (isDevAuth) return entropyToMnemonic(devEntropy, wordlist);

  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: context.rpId,
    credential: await readCredential(context),
    webAuthnClient: context.webAuthnClient,
  });

  const phrase = entropyToMnemonic(prfOutput, wordlist);
  prfOutput.fill(0);
  return phrase;
}
