import { createHash } from "node:crypto";
import { JsonFileStore } from "../store/jsonFile.js";
import { NeonStore } from "../store/neon.js";

export type Redemption = { owner: string; codeHash: string; redeemedAt: number };

const store = process.env.DATABASE_URL ? new NeonStore<Redemption>("referral") : new JsonFileStore<Redemption>("data/referral.json");

const hash = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");

export function validCode(code: string): boolean {
  const accepted = (process.env.REFERRAL_CODES ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
  return accepted.some((entry) => hash(entry) === hash(code));
}

export async function redeem(owner: string, code: string): Promise<void> {
  await store.set(owner.toLowerCase(), { owner: owner.toLowerCase(), codeHash: hash(code), redeemedAt: Date.now() });
}

export async function isUnlockedOwner(owner: string): Promise<boolean> {
  return (await store.get(owner.toLowerCase())) !== undefined;
}

export const forgetReferral = (owner: string) => store.delete(owner.toLowerCase());
