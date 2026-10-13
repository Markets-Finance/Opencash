import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { utf8 } from "@scure/base";
import { cardDigestInput } from "../copy/messages.js";
import { signatureWindowMs } from "../copy/types.js";
import type { StrategyCard } from "../strategy/types.js";
import type { BotMode } from "./types.js";

export type BotAction = "enable" | "disable" | "remove";

function iso(issuedAt: number): string {
  return new Date(issuedAt).toISOString();
}

export function botDigest(card: StrategyCard, mode: BotMode): string {
  return bytesToHex(sha256(utf8.decode(JSON.stringify({ card: cardDigestInput(card), signal: card.signal ?? null, mode }))));
}

export function botMandateMessage(owner: string, network: string, digest: string, issuedAt: number): string {
  return `Run this bot for me on OpenCash.\nOwner: ${owner.toLowerCase()}\nNetwork: ${network}\nDigest: ${digest}\nIssued: ${iso(issuedAt)}`;
}

export function botActionMessage(botId: string, action: BotAction, issuedAt: number): string {
  return `${action[0].toUpperCase()}${action.slice(1)} bot ${botId} on OpenCash.\nIssued: ${iso(issuedAt)}`;
}

export function tradeKeyDigest(apiKey: string): string {
  return bytesToHex(sha256(utf8.decode(apiKey))).slice(0, 16);
}

export function tradeKeyMessage(owner: string, network: string, apiKey: string, issuedAt: number): string {
  return `Let OpenCash trade for me with this Perpl API key.\nOwner: ${owner.toLowerCase()}\nNetwork: ${network}\nKey: ${tradeKeyDigest(apiKey)}\nIssued: ${iso(issuedAt)}`;
}

export function freshSignature(issuedAt: number, now: number = Date.now()): boolean {
  return Number.isFinite(issuedAt) && Math.abs(now - issuedAt) <= signatureWindowMs;
}

export function tradeKeyRemoveMessage(owner: string, network: string, issuedAt: number): string {
  return `Remove my Perpl API key from OpenCash.\nOwner: ${owner.toLowerCase()}\nNetwork: ${network}\nIssued: ${iso(issuedAt)}`;
}

export function vaultWriteMessage(owner: string, namespace: string, digest: string, issuedAt: number): string {
  return `Save my encrypted vault on OpenCash.\nOwner: ${owner.toLowerCase()}\nNamespace: ${namespace}\nDigest: ${digest}\nIssued: ${iso(issuedAt)}`;
}

export function vaultDigest(record: unknown): string {
  return bytesToHex(sha256(utf8.decode(JSON.stringify(record))));
}

export function deleteAccountMessage(owner: string, issuedAt: number): string {
  return `Delete all my OpenCash data.\nOwner: ${owner.toLowerCase()}\nIssued: ${iso(issuedAt)}`;
}
