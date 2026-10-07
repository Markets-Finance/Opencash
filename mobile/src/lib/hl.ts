import {
  coinLogoUrl,
  createHlExchange,
  createHlInfo,
  getAccount,
  getSpotBalances,
  loadCandles as loadHlCandles,
  loadDesk as loadHlDesk,
  loadTradeMarkets as loadHlMarkets,
  type ChartRangeKey,
  type HlWallet,
} from "shared";
import type { Address } from "viem";

export { coinLogoUrl };

export const hlNetwork = "testnet";

export const fallbackCoins = ["BTC", "HYPE", "USDC", "ETH"];

const info = createHlInfo(hlNetwork);

export type HlExchange = ReturnType<typeof createHlExchange>;

let wallet: HlWallet | null = null;

export function getExchange(): HlExchange | null {
  return wallet ? createHlExchange(hlNetwork, wallet) : null;
}

export const loadTradeMarkets = () => loadHlMarkets(info);
export const loadCandles = (coin: string, range: ChartRangeKey) => loadHlCandles(info, coin, range);
export const loadDesk = (user: Address) => loadHlDesk(info, user);

export type HlSummary = {
  total: number;
  unrealizedPnl: number;
  coins: string[];
};

export async function loadHlSummary(user: Address): Promise<HlSummary> {
  const [main, xyz, spot] = await Promise.all([
    getAccount(info, user),
    getAccount(info, user, "xyz"),
    getSpotBalances(info, user),
  ]);
  const positions = [...main.positions, ...xyz.positions];
  const spotUsdc = spot.find((b) => b.coin === "USDC")?.total ?? 0;
  const held = [
    ...positions
      .sort((a, b) => b.positionValue - a.positionValue)
      .map((p) => p.coin.split(":").pop()!),
    ...spot.filter((b) => b.total > 0).map((b) => b.coin),
  ];
  return {
    total: main.equity + xyz.equity + spotUsdc,
    unrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
    coins: [...new Set([...held, ...fallbackCoins])].slice(0, 4),
  };
}
