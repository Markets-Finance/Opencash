export { monadMainnet, monadTestnet } from "./chains.js";
export type { MonadChain } from "./chains.js";
export { monad, monadTestnetChain } from "./viem-chain.js";
export {
  alertsNamespace,
  createTradingAccount,
  deriveNamespaceKey,
  journalNamespace,
  namespaceSalt,
  openJournalSession,
  openNamespaceSession,
  parseSealedRecord,
  profileNamespace,
  relyingPartyId,
  relyingPartyName,
  seal,
  signInTradingAccount,
} from "./mera/index.js";
export type {
  CredentialStore,
  NamespaceSession,
  PasskeyContext,
  SealedRecord,
  TradingAccount,
} from "./mera/index.js";
