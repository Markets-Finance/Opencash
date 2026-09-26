import type { Bin } from "./types.js";

export const bins: Bin[] = [
  {
    id: "mega-cap-tech",
    name: "Mega cap tech",
    thesis: "Four Stock Tokens, weighted toward the two with the deepest USDG pools.",
    legs: [
      { symbol: "AAPL", weightBps: 3000 },
      { symbol: "MSFT", weightBps: 3000 },
      { symbol: "NVDA", weightBps: 2500 },
      { symbol: "GOOGL", weightBps: 1500 },
    ],
  },
  {
    id: "ai-compute",
    name: "AI compute",
    thesis: "The chip and the two hyperscalers spending the most on it.",
    legs: [
      { symbol: "NVDA", weightBps: 5000 },
      { symbol: "MSFT", weightBps: 3000 },
      { symbol: "GOOGL", weightBps: 2000 },
    ],
  },
  {
    id: "consumer-platforms",
    name: "Consumer platforms",
    thesis: "Three balance sheets that live on ad and subscription revenue.",
    legs: [
      { symbol: "AMZN", weightBps: 5000 },
      { symbol: "META", weightBps: 3000 },
      { symbol: "AAPL", weightBps: 2000 },
    ],
  },
  {
    id: "nvda",
    name: "NVDA",
    thesis: "A single leg, for a straight view on one Stock Token.",
    legs: [{ symbol: "NVDA", weightBps: 10000 }],
  },
];

export function binById(id: string): Bin | undefined {
  return bins.find((bin) => bin.id === id);
}
