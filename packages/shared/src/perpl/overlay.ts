import type { PerpPosition } from "./account.js";
import { OrderType } from "./orders.js";

export type ChartLine = { price: number; title: string; color: string; dashed?: boolean };

export type ExitLevels = { stopLossPct?: number; takeProfitPct?: number };

const colors = { entry: "#c3cbc7", liquidation: "#ef5b5b", stop: "#f0a43a", target: "#3ecf8e" };

export function liquidationPriceFor(position: PerpPosition, maintenanceLeverage: number | null): number | null {
  const maintenance = maintenanceLeverage !== null && maintenanceLeverage > 0 ? 1 / maintenanceLeverage : 0;
  if (position.lots <= 0 || maintenance <= 0) return null;
  const long = position.positionType === OrderType.OpenLong;
  const price = long
    ? (position.lots * position.entryPrice - position.deposit) / (position.lots * (1 - maintenance))
    : (position.deposit + position.lots * position.entryPrice) / (position.lots * (1 + maintenance));
  return price > 0 ? price : null;
}

export function tradeOverlay(position: PerpPosition, maintenanceLeverage: number | null, exits: ExitLevels[] = []): ChartLine[] {
  const long = position.positionType === OrderType.OpenLong;
  const leverage = position.deposit > 0 ? (position.lots * position.entryPrice) / position.deposit : 1;
  const lines: ChartLine[] = [{ price: position.entryPrice, title: `${long ? "Long" : "Short"} entry`, color: colors.entry, dashed: true }];
  const liquidation = liquidationPriceFor(position, maintenanceLeverage);
  if (liquidation !== null) lines.push({ price: liquidation, title: "Liquidation", color: colors.liquidation });
  const sign = long ? 1 : -1;
  const stops = exits.map((exit) => exit.stopLossPct).filter((pct): pct is number => pct !== undefined);
  const targets = exits.map((exit) => exit.takeProfitPct).filter((pct): pct is number => pct !== undefined);
  if (stops.length > 0) lines.push({ price: position.entryPrice * (1 - (sign * Math.min(...stops)) / 100 / leverage), title: "Stop", color: colors.stop });
  if (targets.length > 0) lines.push({ price: position.entryPrice * (1 + (sign * Math.min(...targets)) / 100 / leverage), title: "Target", color: colors.target });
  return lines;
}
