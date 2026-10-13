import { chainFor, networkFrom } from "shared";
import { createPublicClient, createWalletClient, http, parseEther, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type GasSender = {
  balanceOf(owner: Address): Promise<bigint>;
  send(owner: Address, amount: bigint): Promise<Hash>;
};

export type GasGrant = { sent: boolean; hash?: Hash; reason?: string };

const dayMs = 86_400_000;
const grantsToday: number[] = [];

export function grantAmount(): bigint {
  return parseEther(process.env.GAS_GRANT_MON ?? "0.5");
}

function dailyCap(): number {
  return Number(process.env.GAS_GRANT_DAILY_CAP ?? 30);
}

export function relayerSender(): GasSender | null {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) return null;
  const network = networkFrom(process.env.NETWORK);
  if (network === "mainnet" && process.env.RELAYER_ALLOW_MAINNET !== "1") return null;
  const chain = chainFor(network);
  const account = privateKeyToAccount(key.startsWith("0x") ? (key as Hash) : (`0x${key}` as Hash));
  const publicClient = createPublicClient({ chain, transport: http() });
  const wallet = createWalletClient({ account, chain, transport: http() });
  return {
    balanceOf: (owner) => publicClient.getBalance({ address: owner }),
    send: async (owner, amount) => {
      const hash = await wallet.sendTransaction({ to: owner, value: amount });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
  };
}

export async function grantGas(owner: Address, sender: GasSender | null = relayerSender(), now: number = Date.now()): Promise<GasGrant> {
  if (!sender) return { sent: false, reason: "relayer is off" };
  while (grantsToday.length > 0 && now - grantsToday[0]! > dayMs) grantsToday.shift();
  if (grantsToday.length >= dailyCap()) return { sent: false, reason: "daily gas limit reached" };
  const amount = grantAmount();
  if ((await sender.balanceOf(owner)) >= amount) return { sent: false, reason: "already has gas" };
  grantsToday.push(now);
  try {
    return { sent: true, hash: await sender.send(owner, amount) };
  } catch (error) {
    grantsToday.pop();
    return { sent: false, reason: error instanceof Error ? error.message.slice(0, 120) : "send failed" };
  }
}
