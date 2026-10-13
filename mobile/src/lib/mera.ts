import "react-native-get-random-values";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { reactNativeWebAuthnClient } from "@category-labs/mera/react-native-webauthn-client";
import {
  clearImportedWallet,
  createTradingAccount,
  importWalletKey,
  relyingPartyId,
  relyingPartyName,
  revealRecoveryPhrase,
  signInTradingAccount,
  type CredentialStore,
  type TradingAccount,
} from "shared";
import { createPublicClient, createWalletClient, http } from "viem";
import { chain } from "./network";

const storageKey = "monad.passkey.credential";
const importStorageKey = "monad.import.v1";
export const rpId = relyingPartyId;

const nativeStore: CredentialStore = {
  read: () => AsyncStorage.getItem(storageKey),
  write: (value) => AsyncStorage.setItem(storageKey, value),
};

const importStore: CredentialStore = {
  read: () => AsyncStorage.getItem(importStorageKey),
  write: async (value) => {
    if (value === "") await AsyncStorage.removeItem(importStorageKey);
    else await AsyncStorage.setItem(importStorageKey, value);
  },
};

export async function hasStoredAccount(): Promise<boolean> {
  const [passkey, imported] = await Promise.all([AsyncStorage.getItem(storageKey), AsyncStorage.getItem(importStorageKey)]);
  return passkey !== null || imported !== null;
}

function passkeyContext() {
  return {
    rpId,
    rpName: relyingPartyName,
    store: nativeStore,
    importStore,
    webAuthnClient: reactNativeWebAuthnClient,
  };
}

export function createAccount(
  userName: string,
  displayName: string,
  importKey?: { privateKey: string; expectedAddress?: string },
): Promise<TradingAccount> {
  return createTradingAccount({ ...passkeyContext(), userName, displayName, importKey });
}

export function signIn(): Promise<TradingAccount> {
  return signInTradingAccount(passkeyContext());
}

export function revealPhrase(): Promise<string> {
  return revealRecoveryPhrase(passkeyContext());
}

export function importWallet(privateKey: string): Promise<`0x${string}`> {
  return importWalletKey(passkeyContext(), { privateKey });
}

export function clearImport(): Promise<void> {
  return clearImportedWallet(passkeyContext());
}

export const publicClient = createPublicClient({
  chain,
  transport: http(),
  batch: { multicall: { wait: 20 } },
});

export function walletClientFor(tradingAccount: TradingAccount) {
  return createWalletClient({
    account: tradingAccount.account,
    chain,
    transport: http(),
  });
}
