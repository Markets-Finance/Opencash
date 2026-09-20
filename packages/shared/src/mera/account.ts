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
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { LocalAccount } from "viem";

const evmAccountPath = "m/44'/60'/0'/0/0";

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

export async function signInTradingAccount(
  context: PasskeyContext,
): Promise<TradingAccount> {
  const stored = await context.store.read();
  const known: PasskeyCredentialMetadata | undefined =
    stored === null ? undefined : JSON.parse(stored);

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
