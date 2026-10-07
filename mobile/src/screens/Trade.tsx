import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { perpl, type TradingAccount } from "shared";
import { AssetMark } from "../components/AssetMark";
import { LineChart } from "../components/LineChart";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import {
  candleRanges,
  closePosition,
  loadCandles,
  loadMarkets,
  loadOpenPositions,
  openBin,
  singleLegBin,
  sizeBinFor,
  type Candle,
  type CandleRangeKey,
  type MarketData,
  type OpenPosition,
} from "../lib/perpl";
import { dark, family, space, touch, track } from "../theme";

type Direction = "long" | "short";
type Status = { text: string; failed: boolean } | null;

const leverageChoices = [1, 2, 3, 5];
const rangeKeys = Object.keys(candleRanges) as CandleRangeKey[];

function usd(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function px(value: number): string {
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}
function stamp(time: number, range: CandleRangeKey): string {
  const date = new Date(time);
  return candleRanges[range].spanMs <= 86_400_000
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type TradeProps = {
  trader: TradingAccount;
  onSelectTab: (key: TabKey) => void;
};

export function Trade({ trader, onSelectTab }: TradeProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<MarketData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("BTC");
  const [direction, setDirection] = useState<Direction>("long");
  const [leverage, setLeverage] = useState(3);
  const [amount, setAmount] = useState("");
  const [range, setRange] = useState<CandleRangeKey>("1d");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [positions, setPositions] = useState<OpenPosition[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const refreshPositions = useCallback(
    (markets: MarketData) => {
      loadOpenPositions(trader.address, markets)
        .then(setPositions)
        .catch(() => setPositions([]));
    },
    [trader.address],
  );

  useEffect(() => {
    let live = true;
    loadMarkets()
      .then((next) => {
        if (!live) return;
        setData(next);
        refreshPositions(next);
        const live_ = [...next.markets.values()].filter((m) => m.numOrders > 0);
        if (!next.markets.has("BTC") && live_.length > 0) setSymbol(live_[0].symbol);
      })
      .catch((error) => live && setLoadError(errorText(error)));
    return () => {
      live = false;
    };
  }, [refreshPositions]);

  useEffect(() => {
    const target = data?.markets.get(symbol);
    if (!target) return;
    let live = true;
    setCandles(null);
    loadCandles(target, range)
      .then((next) => live && setCandles(next))
      .catch(() => live && setCandles([]));
    return () => {
      live = false;
    };
  }, [data, symbol, range]);

  const rangeChange =
    candles && candles.length >= 2
      ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
      : null;

  const tradable = useMemo(
    () => [...(data?.markets.values() ?? [])].filter((m) => m.numOrders > 0),
    [data],
  );
  const market = data?.markets.get(symbol) ?? null;
  const cap = data?.maxLeverage.get(symbol) ?? leverage;
  const margin = Number(amount) || 0;

  const preview = useMemo(() => {
    if (!data || !market || margin <= 0) return null;
    return sizeBinFor(singleLegBin(symbol, direction, Math.min(leverage, cap)), margin, data);
  }, [data, market, symbol, direction, leverage, cap, margin]);

  const leg = preview?.sized.legs[0] ?? null;

  async function submit() {
    if (!data || !preview || !leg) return;
    setBusy(true);
    setStatus({ text: "Sending…", failed: false });
    try {
      await openBin(trader, preview.sized, data, (step) =>
        setStatus({ text: step === "orders" ? "Opening position…" : "Funding account…", failed: false }),
      );
      setStatus({ text: `${direction === "long" ? "Long" : "Short"} ${symbol} is open.`, failed: false });
      setAmount("");
      refreshPositions(data);
    } catch (error) {
      setStatus({ text: errorText(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  async function close(entry: OpenPosition) {
    if (!data) return;
    setBusy(true);
    setStatus({ text: "Closing…", failed: false });
    try {
      await closePosition(trader, entry);
      setStatus({ text: `${entry.market.symbol} closed.`, failed: false });
      refreshPositions(data);
    } catch (error) {
      setStatus({ text: errorText(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  const blocked = busy
    ? "Working…"
    : margin <= 0
      ? "Enter an amount"
      : !leg
        ? (preview?.issues[0]?.detail ?? "Size is below one lot")
        : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Trade</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Perpl · Monad Testnet</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + insets.bottom + touch + space.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loadError !== null ? (
          <Text style={styles.error}>{loadError}</Text>
        ) : market === null ? (
          <ActivityIndicator color={dark.ink} />
        ) : (
          <View style={styles.marketHead}>
            <AssetMark symbol={market.symbol} size={space.xxl + space.sm} />
            <View style={styles.flex}>
              <Text style={styles.marketSymbol}>{market.symbol}</Text>
              <Text style={styles.muted}>{market.name}</Text>
            </View>
            <View style={styles.alignEnd}>
              <Text style={styles.marketPrice}>{px(market.mark)}</Text>
              <Text style={styles.muted}>Max {cap}x</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>PRICE</Text>
            {rangeChange !== null && (
              <Text style={rangeChange >= 0 ? styles.up : styles.down}>
                {`${rangeChange >= 0 ? "+" : ""}${rangeChange.toFixed(2)}%`} this range
              </Text>
            )}
          </View>
          {candles === null ? (
            <View style={styles.chartEmpty}>
              <ActivityIndicator color={dark.ink} />
            </View>
          ) : candles.length < 2 ? (
            <View style={styles.chartEmpty}>
              <Text style={styles.muted}>No trades in this range on Monad testnet.</Text>
            </View>
          ) : (
            <LineChart
              values={candles.map((c) => c.close)}
              height={200}
              color={dark.green}
              label={(i) => `${stamp(candles[i].time, range)} · ${px(candles[i].close)}`}
            />
          )}
          <View style={styles.segment}>
            {rangeKeys.map((key) => (
              <Pressable
                key={key}
                onPress={() => setRange(key)}
                style={[styles.segmentItem, range === key && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentLabel, range === key && styles.segmentLabelActive]}>
                  {key.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {tradable.map((m) => (
            <Pressable
              key={m.symbol}
              onPress={() => setSymbol(m.symbol)}
              style={[styles.chip, m.symbol === symbol && styles.chipActive]}
            >
              <AssetMark symbol={m.symbol} size={24} />
              <Text style={styles.chipLabel}>{m.symbol}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.card}>
          <View style={styles.segment}>
            {(["long", "short"] as Direction[]).map((side) => (
              <Pressable
                key={side}
                onPress={() => setDirection(side)}
                style={[styles.segmentItem, direction === side && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentLabel, direction === side && styles.segmentLabelActive]}>
                  {side === "long" ? "Long" : "Short"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>MARGIN (AUSD)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={dark.muted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>LEVERAGE</Text>
          <View style={styles.row}>
            {leverageChoices.filter((value) => value <= cap).map((value) => (
              <Pressable
                key={value}
                onPress={() => setLeverage(value)}
                style={[styles.chip, leverage === value && styles.chipActive]}
              >
                <Text style={styles.chipLabel}>{value}x</Text>
              </Pressable>
            ))}
          </View>

          {leg !== null && (
            <Text style={styles.muted}>
              {leg.lots} {symbol} · {usd(leg.notional)} notional · {leg.leverage}x
            </Text>
          )}

          <Pressable
            disabled={blocked !== null}
            onPress={() => void submit()}
            style={[styles.primary, direction === "short" && styles.short, blocked !== null && styles.disabled]}
          >
            <Text style={styles.primaryLabel}>{blocked ?? `${direction === "long" ? "Long" : "Short"} ${symbol}`}</Text>
          </Pressable>
          {status !== null && <Text style={status.failed ? styles.error : styles.muted}>{status.text}</Text>}
        </View>

        <Text style={styles.sectionTitle}>POSITIONS</Text>
        {positions === null ? (
          <ActivityIndicator color={dark.ink} />
        ) : positions.length === 0 ? (
          <Text style={styles.empty}>No open positions on Monad testnet for this address.</Text>
        ) : (
          <View style={styles.card}>
            {positions.map((entry) => (
              <View key={entry.market.perpId} style={styles.listRow}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    {entry.position.positionType === perpl.OrderType.OpenLong ? "Long" : "Short"} {entry.market.symbol}
                  </Text>
                  <Text style={styles.muted}>
                    {entry.position.lots} @ {px(entry.position.entryPrice)} · margin {usd(entry.position.deposit)}
                  </Text>
                </View>
                <Text style={entry.position.pnl >= 0 ? styles.up : styles.down}>{usd(entry.position.pnl)}</Text>
                <Pressable disabled={busy} onPress={() => void close(entry)} style={styles.smallButton}>
                  <Text style={styles.smallLabel}>Close</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TabBar active="trade" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  header: { paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontFamily: family.semibold, fontSize: 25, letterSpacing: track(25, -0.04), color: dark.ink },
  badge: { borderRadius: 999, paddingVertical: space.xs, paddingHorizontal: space.md, backgroundColor: dark.surface },
  badgeLabel: { fontFamily: family.medium, fontSize: 11, color: dark.ink },
  content: { padding: space.lg, gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  alignEnd: { alignItems: "flex-end" },
  row: { flexDirection: "row", gap: space.sm },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chartEmpty: { height: 200, alignItems: "center", justifyContent: "center" },
  marketHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  marketSymbol: { fontFamily: family.semibold, fontSize: 19, color: dark.ink },
  marketPrice: { fontFamily: family.semibold, fontSize: 19, color: dark.ink },
  muted: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  up: { fontFamily: family.medium, fontSize: 13, color: dark.green },
  down: { fontFamily: family.medium, fontSize: 13, color: dark.red },
  error: { fontFamily: family.regular, fontSize: 13, color: dark.red },
  empty: { fontFamily: family.regular, fontSize: 13, color: dark.muted, textAlign: "center", paddingVertical: space.xl },
  card: { padding: space.lg, borderRadius: 18, backgroundColor: dark.surface, gap: space.md },
  sectionTitle: { fontFamily: family.medium, fontSize: 11, letterSpacing: track(11, 0.12), color: dark.muted },
  segment: { flexDirection: "row", borderRadius: 999, backgroundColor: dark.surfaceHover, padding: 3 },
  segmentItem: { flex: 1, minHeight: touch, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  segmentItemActive: { backgroundColor: dark.line },
  segmentLabel: { fontFamily: family.medium, fontSize: 13, color: dark.muted },
  segmentLabelActive: { color: dark.ink },
  chips: { gap: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: 999, paddingVertical: space.sm, paddingHorizontal: space.md, backgroundColor: dark.surfaceHover, borderWidth: 1, borderColor: "transparent" },
  chipActive: { borderColor: dark.green },
  chipLabel: { fontFamily: family.semibold, fontSize: 13, color: dark.ink },
  fieldLabel: { fontFamily: family.medium, fontSize: 11, letterSpacing: track(11, 0.12), color: dark.muted },
  input: { fontFamily: family.light, fontSize: 32, letterSpacing: track(32, -0.04), color: dark.ink, padding: 0 },
  primary: { minHeight: touch + space.md, borderRadius: 999, backgroundColor: dark.green, alignItems: "center", justifyContent: "center" },
  short: { backgroundColor: dark.red },
  primaryLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.paper },
  disabled: { opacity: 0.45 },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rowTitle: { fontFamily: family.semibold, fontSize: 14, color: dark.ink },
  smallButton: { borderRadius: 999, paddingVertical: space.sm, paddingHorizontal: space.md, backgroundColor: dark.surfaceHover },
  smallLabel: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
});
