import type { Bin } from "./types.js";

export const bins: Bin[] = [
  {
    id: "majors",
    name: "Blue Chip Boomers",
    thesis: "The three deepest books on Monad, weighted by where the liquidity actually is.",
    legs: [
      { symbol: "BTC", direction: "long", weightBps: 4000, leverage: 3 },
      { symbol: "ETH", direction: "long", weightBps: 3500, leverage: 3 },
      { symbol: "SOL", direction: "long", weightBps: 2500, leverage: 3 },
    ],
  },
  {
    id: "l1s",
    name: "Chain Gang",
    thesis: "Four settlement layers in one position, including the chain this runs on.",
    legs: [
      { symbol: "ETH", direction: "long", weightBps: 3000, leverage: 3 },
      { symbol: "SOL", direction: "long", weightBps: 3000, leverage: 3 },
      { symbol: "MON", direction: "long", weightBps: 2500, leverage: 3 },
      { symbol: "HYPE", direction: "long", weightBps: 1500, leverage: 3 },
    ],
  },
  {
    id: "monad",
    name: "Monad Maxis",
    thesis: "A single leg on MON, for a view on the chain itself.",
    legs: [{ symbol: "MON", direction: "long", weightBps: 10000, leverage: 5 }],
  },
  {
    id: "quality-spread",
    name: "Pump the Brakes",
    thesis: "Long the deepest book, short the thinnest. A spread that takes two trades by hand.",
    legs: [
      { symbol: "BTC", direction: "long", weightBps: 6000, leverage: 3 },
      { symbol: "PUMP", direction: "short", weightBps: 4000, leverage: 3 },
    ],
  },
  {
    id: "satoshi-lovers",
    name: "Satoshi's Lovers",
    thesis: "Bitcoin first, with Zcash on the side for the cypherpunk in all of us.",
    legs: [
      { symbol: "BTC", direction: "long", weightBps: 6500, leverage: 3 },
      { symbol: "ZEC", direction: "long", weightBps: 3500, leverage: 3 },
    ],
  },
  {
    id: "hyper-fans",
    name: "Hyper Fans",
    thesis: "Three tokens from the Hyperliquid crowd. If they trend, you ride all three.",
    legs: [
      { symbol: "HYPE", direction: "long", weightBps: 4000, leverage: 3 },
      { symbol: "LIT", direction: "long", weightBps: 3000, leverage: 3 },
      { symbol: "VVV", direction: "long", weightBps: 3000, leverage: 3 },
    ],
  },
  {
    id: "defi-degens",
    name: "Degens Anonymous",
    thesis: "Ethereum, its favourite exchange token and Hyperliquid's own. For people who read docs.",
    legs: [
      { symbol: "ETH", direction: "long", weightBps: 4000, leverage: 3 },
      { symbol: "UNI", direction: "long", weightBps: 3500, leverage: 3 },
      { symbol: "HYPE", direction: "long", weightBps: 2500, leverage: 3 },
    ],
  },
];

export function binById(id: string): Bin | undefined {
  return bins.find((bin) => bin.id === id);
}
