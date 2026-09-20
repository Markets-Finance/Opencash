import { getPasskeyPrfOutput, type PasskeyCredentialMetadata } from "@category-labs/mera";
import type { PasskeyContext } from "./account.js";
import {
  deriveNamespaceKey,
  namespaceSalt,
  open,
  seal,
  type SealedRecord,
} from "./namespace.js";

export const journalNamespace = "terminal.journal.v1";
export const alertsNamespace = "terminal.alerts.v1";

export type NamespaceSession = {
  namespace: string;
  seal(plaintext: string): SealedRecord;
  open(record: SealedRecord): string;
};

export async function openNamespaceSession(
  context: PasskeyContext,
  namespace: string,
): Promise<NamespaceSession> {
  const stored = await context.store.read();
  const credential: PasskeyCredentialMetadata | undefined =
    stored === null ? undefined : JSON.parse(stored);

  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: context.rpId,
    credential,
    prfSalt: namespaceSalt(namespace),
    webAuthnClient: context.webAuthnClient,
  });

  const key = deriveNamespaceKey(prfOutput, namespace);
  prfOutput.fill(0);

  return {
    namespace,
    seal: (plaintext) => seal(key, namespace, plaintext),
    open: (record) => open(key, record),
  };
}

export function openJournalSession(
  context: PasskeyContext,
): Promise<NamespaceSession> {
  return openNamespaceSession(context, journalNamespace);
}
