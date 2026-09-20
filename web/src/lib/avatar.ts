import { Avatar, Style } from "@dicebear/core";
import definition from "@dicebear/styles/notionists.json" with { type: "json" };

const style = new Style(definition);

export function avatarSeed(address: string, variant: number): string {
  return variant === 0 ? address : `${address}#${variant}`;
}

export function avatarDataUri(seed: string): string {
  return new Avatar(style, {
    seed,
    backgroundColor: ["7165ed", "d7d5d1", "252527"],
    borderRadius: 50,
  }).toDataUri();
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
