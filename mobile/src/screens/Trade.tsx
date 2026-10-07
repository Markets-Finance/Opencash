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
import { CardTitle, ScreenTitle, SelectPill, Switcher, Tag, ToneCard, tone } from "../components/ui";
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
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: tabBarHeight + insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title="Trade" right={<Tag label="Monad Testnet" dot={dark.green} />} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {tradable.map((m) => (
            <Pressable key={m.symbol} onPress={() => setSymbol(m.symbol)} style={[styles.chip, m.symbol === symbol && styles.chipActive]}>
              <AssetMark symbol={m.symbol} size={22} />
              <Text style={[styles.chipLabel, m.symbol === symbol && styles.chipLabelActive]}>{m.symbol}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loadError !== null && <Text style={styles.error}>{loadError}</Text>}

        <ToneCard fill={tone.violet}>
          {market === null ? (
            <ActivityIndicator color={tone.ink} />
          ) : (
            <View style={styles.marketHead}>
              <AssetMark symbol={market.symbol} size={44} />
              <View style={styles.flex}>
                <Text style={styles.marketSymbol}>{market.symbol}</Text>
                <Text style={styles.onColorMuted}>Max {cap}x leverage</Text>
              </View>
              <Text style={styles.marketPrice}>{px(market.mark)}</Text>
            </View>
          )}
          {rangeChange !== null && (
            <View style={styles.changeTag}>
              <Text style={styles.changeText}>
                {rangeChange >= 0 ? "▲" : "▼"} {Math.abs(rangeChange).toFixed(2)}% over {range.toUpperCase()}
              </Text>
            </View>
          )}
          {candles === null ? (
            <View style={styles.chartEmpty}>
              <ActivityIndicator color={tone.ink} />
            </View>
          ) : candles.length < 2 ? (
            <View style={styles.chartEmpty}>
              <Text style={styles.onColorMuted}>No trades in this range on Monad testnet.</Text>
            </View>
          ) : (
            <LineChart
              values={candles.map((c) => c.close)}
              height={180}
              color={tone.ink}
              label={(i) => `${stamp(candles[i].time, range)} · ${px(candles[i].close)}`}
            />
          )}
          <View style={styles.ranges}>
            {rangeKeys.map((key) => (
              <Pressable key={key} onPress={() => setRange(key)} style={[styles.range, range === key && styles.rangeActive]}>
                <Text style={[styles.rangeLabel, range === key && styles.rangeLabelActive]}>{key.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </ToneCard>

        <ToneCard>
          <CardTitle>New position</CardTitle>
          <Switcher
            items={[
              { key: "long", label: "Long", dot: dark.green },
              { key: "short", label: "Short", dot: dark.red },
            ]}
            value={direction}
            onChange={setDirection}
          />
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
              <SelectPill key={value} label={`${value}x`} active={leverage === value} onPress={() => setLeverage(value)} />
            ))}
          </View>
          {leg !== null && (
            <View style={styles.tags}>
              <Tag label={`${leg.lots} ${symbol}`} />
              <Tag label={`${usd(leg.notional)} position`} />
              <Tag label={`${leg.leverage}x`} />
            </View>
          )}
          <Pressable
            disabled={blocked !== null}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: direction === "long" ? dark.green : tone.coral },
              blocked !== null && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryLabel}>{blocked ?? `${direction === "long" ? "Long" : "Short"} ${symbol}`}</Text>
          </Pressable>
          {status !== null && <Text style={status.failed ? styles.error : styles.muted}>{status.text}</Text>}
        </ToneCard>

        <Text style={styles.section}>POSITIONS</Text>
        {positions === null ? (
          <ActivityIndicator color={dark.ink} />
        ) : positions.length === 0 ? (
          <Text style={styles.muted}>No open positions on Monad testnet for this address.</Text>
        ) : (
          positions.map((entry) => {
            const long = entry.position.positionType === perpl.OrderType.OpenLong;
            return (
              <ToneCard key={entry.market.perpId}>
                <View style={styles.marketHead}>
                  <AssetMark symbol={entry.market.symbol} size={36} />
                  <Text style={styles.positionTitle}>
                    {long ? "LONG" : "SHORT"} {entry.market.symbol}
                  </Text>
                  <Text style={[styles.pnl, { color: entry.position.pnl >= 0 ? dark.green : dark.red }]}>{usd(entry.position.pnl)}</Text>
                </View>
                <View style={styles.tags}>
                  <Tag label={`${entry.position.lots} lots`} dot={long ? dark.green : dark.red} />
                  <Tag label={`Entry ${px(entry.position.entryPrice)}`} />
                  <Tag label={`Margin ${usd(entry.position.deposit)}`} />
                </View>
                <Pressable disabled={busy} onPress={() => void close(entry)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Text style={styles.closeLabel}>Close position</Text>
                </Pressable>
              </ToneCard>
            );
          })
        )}
      </ScrollView>

      <TabBar active="trade" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chips: { gap: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, minHeight: touch, borderRadius: 999, backgroundColor: tone.card },
  chipActive: { backgroundColor: tone.paper },
  chipLabel: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
  chipLabelActive: { color: tone.ink },
  marketHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  marketSymbol: { fontFamily: family.semibold, fontSize: 24, letterSpacing: -0.8, color: tone.ink },
  marketPrice: { fontFamily: family.medium, fontSize: 26, letterSpacing: -1, color: tone.ink },
  onColorMuted: { fontFamily: family.regular, fontSize: 12, color: "rgba(20, 24, 26, 0.7)" },
  changeTag: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: space.sm, borderRadius: 999, backgroundColor: tone.ink },
  changeText: { fontFamily: family.medium, fontSize: 12, color: tone.paper },
  chartEmpty: { height: 180, alignItems: "center", justifyContent: "center" },
  ranges: { flexDirection: "row", gap: space.xs },
  range: { flex: 1, minHeight: touch, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.35)" },
  rangeActive: { backgroundColor: tone.ink },
  rangeLabel: { fontFamily: family.medium, fontSize: 12, color: tone.ink },
  rangeLabelActive: { color: tone.paper },
  fieldLabel: { fontFamily: family.medium, fontSize: 11, letterSpacing: track(11, 0.12), color: dark.muted },
  input: { fontFamily: family.light, fontSize: 40, letterSpacing: track(40, -0.04), color: dark.ink, padding: 0 },
  primary: { minHeight: touch + space.md, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontFamily: family.semibold, fontSize: 15, color: tone.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  muted: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  error: { fontFamily: family.regular, fontSize: 13, color: dark.red },
  section: { fontFamily: family.semibold, fontSize: 22, letterSpacing: -0.8, color: dark.ink },
  positionTitle: { flex: 1, fontFamily: family.semibold, fontSize: 18, letterSpacing: -0.5, color: dark.ink },
  pnl: { fontFamily: family.semibold, fontSize: 16 },
  closeButton: { minHeight: touch, borderRadius: 999, backgroundColor: tone.raised, alignItems: "center", justifyContent: "center" },
  closeLabel: { fontFamily: family.medium, fontSize: 14, color: dark.ink },
});
