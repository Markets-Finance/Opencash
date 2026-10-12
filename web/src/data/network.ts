import { chainFor, networkFrom, networkLabel, perplFor } from "shared";

export const network = networkFrom(import.meta.env.PUBLIC_NETWORK);
export const chain = chainFor(network);
export const deployment = perplFor(network);
export const label = networkLabel(network);
export const explorer = network === "mainnet" ? "https://monadscan.com" : "https://testnet.monadexplorer.com";
