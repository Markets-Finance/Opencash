import { perpl } from "shared";
import { contextFor, type Net } from "./context.js";

export type HeldPosition = {
  symbol: string;
  side: "long" | "short";
  lots: number;
  notionalUsd: number;
  entryPrice: number;
  markPrice: number;
  marginUsd: number;
  leverage: number | null;
  unrealizedPnlUsd: number;
  liquidationPrice: number | null;
  liquidationDistancePct: number | null;
};

type Book = { at: number; markets: perpl.PerpMarket[]; maintenance: Map<number, number> };

const bookTtlMs = 600_000;
const defaultMaintenance = 0.05;
const books = new Map<Net, Book>();

export async function marketBook(net: Net): Promise<Book> {
  const hit = books.get(net);
  if (hit && Date.now() - hit.at < bookTtlMs) return hit;
  const { client, deployment } = contextFor(net);
  const markets = await perpl.fetchMarkets(client, deployment.exchange);
  const maintenance = new Map<number, number>();
  await Promise.all(
    markets.map(async (market) => {
      const terms = await perpl.fetchMarginTerms(client, deployment.exchange, market, 1).catch(() => null);
      if (terms && terms.maintenanceLeverage > 0) maintenance.set(market.perpId, 1 / terms.maintenanceLeverage);
    }),
  );
  const book = { at: Date.now(), markets, maintenance };
  books.set(net, book);
  return book;
}

export async function heldPositions(net: Net, accountId: bigint): Promise<HeldPosition[]> {
  const { client, deployment } = contextFor(net);
  const book = await marketBook(net);
  const rows = await Promise.all(
    book.markets.map(async (market): Promise<HeldPosition | null> => {
      const position = await perpl.fetchPosition(client, deployment.exchange, market, accountId).catch(() => null);
      if (position === null) return null;
      const long = position.positionType === perpl.OrderType.OpenLong;
      const notional = position.lots * position.mark;
      const maint = book.maintenance.get(market.perpId) ?? defaultMaintenance;
      const liquidation = long
        ? (position.lots * position.entryPrice - position.deposit) / (position.lots * (1 - maint))
        : (position.deposit + position.lots * position.entryPrice) / (position.lots * (1 + maint));
      return {
        symbol: market.symbol,
        side: long ? "long" : "short",
        lots: position.lots,
        notionalUsd: notional,
        entryPrice: position.entryPrice,
        markPrice: position.mark,
        marginUsd: position.deposit,
        leverage: position.deposit > 0 ? notional / position.deposit : null,
        unrealizedPnlUsd: position.pnl,
        liquidationPrice: Number.isFinite(liquidation) && liquidation > 0 ? liquidation : null,
        liquidationDistancePct: Number.isFinite(liquidation) && position.mark > 0 ? (Math.abs(position.mark - liquidation) / position.mark) * 100 : null,
      };
    }),
  );
  return rows.filter((row): row is HeldPosition => row !== null);
}
