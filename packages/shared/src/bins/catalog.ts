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
  {
    id: "semiconductors",
    name: "Semiconductors",
    thesis: "Four chipmakers beyond the GPU leader — foundry, wireless, and legacy silicon all weighted in.",
    legs: [
      { symbol: "AVGO", weightBps: 3000 },
      { symbol: "QCOM", weightBps: 2500 },
      { symbol: "AMD", weightBps: 2500 },
      { symbol: "INTC", weightBps: 2000 },
    ],
  },
  {
    id: "aerospace-defense",
    name: "Aerospace & Defense",
    thesis: "The two primes behind most Western military and commercial airframes.",
    legs: [
      { symbol: "LMT", weightBps: 5500 },
      { symbol: "BA", weightBps: 4500 },
    ],
  },
  {
    id: "precious-metals",
    name: "Precious Metals",
    thesis: "Gold anchors it, silver adds the higher-beta swing — a hedge outside big tech.",
    legs: [
      { symbol: "GLD", weightBps: 6500 },
      { symbol: "SLV", weightBps: 3500 },
    ],
  },
];

export function binById(id: string): Bin | undefined {
  return bins.find((bin) => bin.id === id);
}
