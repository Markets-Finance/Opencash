import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { binSeries, binView, type Bin, type BinPosition as HeldBin, type TradingAccount } from "shared";
import { closePosition, loadCandles, type CandleRangeKey, type MarketData } from "../lib/perpl";
import { dark, family, space, touch } from "../theme";
import { AssetMark, LegStack } from "./AssetMark";
import { LineChart } from "./LineChart";
import { ProtectSheet } from "./ProtectSheet";
import { tone } from "./ui";

function usd(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function px(value: number): string {
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

type Props = {
  bin: Bin;
  held: HeldBin;
  data: MarketData;
  trader: TradingAccount;
  onBack: () => void;
  onAdd: () => void;
  onOpenAsset: (symbol: string) => void;
  onClosed: () => void;
};

export function BinPosition({ bin, held, data, trader, onBack, onAdd, onOpenAsset, onClosed }: Props) {
  const insets = useSafeAreaInsets();
  const view = useMemo(() => binView(held, data.markets), [held, data]);
  const [range, setRange] = useState<"1d" | "1w">("1d");
  const [series, setSeries] = useState<{ time: number; value: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [protecting, setProtecting] = useState(false);

  useEffect(() => {
    let live = true;
    setSeries(null);
    const prices = new Map<string, { time: number; close: number }[]>();
    Promise.all(
      view.legs.map(async (leg) => {
        const market = data.markets.get(leg.symbol);
        if (market) prices.set(leg.symbol, (await loadCandles(market, range as CandleRangeKey)).map((c) => ({ time: c.time, close: c.close })));
      }),
    )
      .then(() => live && setSeries(binSeries(view, prices)))
      .catch(() => live && setSeries([]));
    return () => {
      live = false;
    };
  }, [view, range, data]);

  function confirmClose() {
    Alert.alert(`Close ${bin.name}?`, "Every leg closes at market.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close all legs",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            for (const leg of held.legs) {
              const market = data.markets.get(leg.symbol);
              if (!market) continue;
              setStatus(`Closing ${leg.symbol}…`);
              await closePosition(trader, { market, position: leg.position });
            }
            setStatus(`${bin.name} is closed.`);
            onClosed();
          } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
            setBusy(false);
          }
        },
      },
    ]);
  }

  const protectLegs = (() => {
    const legs = view.legs.map((leg) => ({ symbol: leg.symbol, direction: leg.direction, leverage: Math.max(1, Math.round((leg.units * leg.mark) / (leg.margin || 1))), weightBps: Math.round(leg.allocationPct * 100) }));
    if (legs.length > 0) legs[legs.length - 1]!.weightBps += 10000 - legs.reduce((sum, leg) => sum + leg.weightBps, 0);
    return legs;
  })();
  const up = view.pnl >= 0;
  const color = up ? dark.green : dark.red;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.heading}>{bin.name}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <LegStack symbols={bin.legs.map((leg) => leg.symbol)} size={40} />
          <Text style={styles.thesis}>{bin.thesis}</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>Margin in</Text><Text style={styles.statValue}>{usd(view.margin)}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>P&L</Text><Text style={[styles.statValue, { color }]}>{usd(view.pnl)}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Return</Text><Text style={[styles.statValue, { color }]}>{view.pnlPct.toFixed(2)}%</Text></View>
        </View>

        <View style={styles.chartHead}>
          <Text style={styles.section}>BIN P&L AT YOUR ENTRY</Text>
          <View style={styles.chips}>
            {(["1d", "1w"] as const).map((key) => (
              <Pressable key={key} onPress={() => setRange(key)} style={[styles.chip, range === key && styles.chipOn]}>
                <Text style={[styles.chipLabel, range === key && styles.chipLabelOn]}>{key === "1d" ? "1D" : "1W"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {series === null ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : series.length < 2 ? (
          <Text style={styles.muted}>Not enough price history yet.</Text>
        ) : (
          <LineChart values={series.map((point) => point.value)} height={170} color={color} label={(index) => `${new Date(series[index]!.time).toLocaleString()} · ${usd(series[index]!.value)}`} />
        )}

        <Text style={styles.section}>YOUR LEGS</Text>
        {view.legs.map((leg) => (
          <Pressable key={leg.symbol} onPress={() => onOpenAsset(leg.symbol)} style={({ pressed }) => [styles.leg, pressed && { opacity: 0.8 }]}>
            <View style={styles.legTop}>
              <AssetMark symbol={leg.symbol} size={34} />
              <View style={styles.legName}>
                <Text style={styles.legTitle}>{leg.direction === "long" ? "Long" : "Short"} {leg.symbol}</Text>
                <Text style={styles.muted}>{leg.allocationPct.toFixed(0)}% of margin · {leg.units.toLocaleString(undefined, { maximumFractionDigits: 4 })} units</Text>
              </View>
              <Text style={[styles.legPnl, { color: leg.pnl >= 0 ? dark.green : dark.red }]}>{usd(leg.pnl)}</Text>
            </View>
            <View style={styles.legBottom}>
              <Text style={styles.muted}>Avg entry {px(leg.entry)}</Text>
              <Text style={styles.muted}>Mark {px(leg.mark)}</Text>
              <Text style={styles.muted}>Margin {usd(leg.margin)}</Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.muted}>Strategy: {bin.thesis} Margin is split {view.legs.map((leg) => `${leg.allocationPct.toFixed(0)}% ${leg.symbol}`).join(", ")}.</Text>
        {status !== null && <Text style={styles.muted}>{status}</Text>}
      </ScrollView>

      {protecting && <ProtectSheet visible title={`${bin.name} guard`} legs={protectLegs} marginUsd={view.margin} allowTarget={false} onClose={() => setProtecting(false)} />}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable onPress={onAdd} disabled={busy} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.primaryLabel}>Add to this bin</Text>
        </Pressable>
        <Pressable onPress={() => setProtecting(true)} disabled={busy} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.secondaryLabel}>Stop loss for all legs</Text>
        </Pressable>
        <Pressable onPress={confirmClose} disabled={busy} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.secondaryLabel}>{busy ? "Working…" : "Close all legs"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  back: { fontFamily: family.medium, fontSize: 22, color: dark.ink },
  heading: { fontFamily: family.semibold, fontSize: 20, letterSpacing: -0.5, color: dark.ink },
  content: { padding: space.lg, gap: space.md },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  thesis: { flex: 1, fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.muted },
  stats: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, padding: space.md, borderRadius: 18, backgroundColor: tone.card, gap: 2 },
  statLabel: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  statValue: { fontFamily: family.semibold, fontSize: 16, color: dark.ink },
  chartHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { fontFamily: family.semibold, fontSize: 12, letterSpacing: 1, color: dark.muted, marginTop: space.sm },
  chips: { flexDirection: "row", gap: space.xs },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: tone.card },
  chipOn: { backgroundColor: tone.lime },
  chipLabel: { fontFamily: family.medium, fontSize: 12, color: dark.ink },
  chipLabelOn: { color: tone.ink },
  leg: { padding: space.md, borderRadius: 20, backgroundColor: tone.card, gap: space.sm },
  legTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  legName: { flex: 1, gap: 2 },
  legTitle: { fontFamily: family.semibold, fontSize: 16, color: dark.ink },
  legPnl: { fontFamily: family.semibold, fontSize: 15 },
  legBottom: { flexDirection: "row", justifyContent: "space-between" },
  muted: { fontFamily: family.regular, fontSize: 12, lineHeight: 17, color: dark.muted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, backgroundColor: dark.paper },
  primary: { minHeight: touch + space.sm, borderRadius: 999, backgroundColor: tone.lime, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontFamily: family.semibold, fontSize: 16, color: tone.ink },
  secondary: { minHeight: touch, borderRadius: 999, backgroundColor: tone.raised, alignItems: "center", justifyContent: "center" },
  secondaryLabel: { fontFamily: family.medium, fontSize: 14, color: dark.ink },
});
