import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bins, type BinPosition, type MarketChart, type TradingAccount } from "shared";
import { AssetMark, LegStack } from "../components/AssetMark";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import {
  fetchMarketCharts,
  fetchPortfolioHistory,
  snapshotPortfolio,
  type PortfolioSnapshot,
} from "../lib/backend";
import { loadPositions, loadTokens, loadUsdgBalance } from "../lib/hood";
import { family, space, track } from "../theme";

const featuredSymbols = [...new Set(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)))];

type Range = "1d" | "7d" | "30d" | "all";

type HomeProps = {
  trader: TradingAccount;
  onSelectTab: (key: TabKey) => void;
};

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function pct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function filterByRange(history: PortfolioSnapshot[], range: Range): PortfolioSnapshot[] {
  if (range === "all") return history;
  const days = range === "1d" ? 1 : range === "7d" ? 7 : 30;
  const cutoff = Date.now() - days * 86_400_000;
  return history.filter((snapshot) => Date.parse(snapshot.createdAt) >= cutoff);
}

export function Home({ trader, onSelectTab }: HomeProps) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [positions, setPositions] = useState<BinPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charts, setCharts] = useState<Record<string, MarketChart> | null>(null);
  const [history, setHistory] = useState<PortfolioSnapshot[] | null>(null);
  const [range, setRange] = useState<Range>("1d");

  function refreshBalance() {
    loadUsdgBalance(trader.address)
      .then((next) => {
        setBalance(next);
        setUpdatedAt(new Date().toLocaleTimeString());
      })
      .catch(() => setBalance(null));
  }

  useEffect(refreshBalance, [trader.address]);

  useEffect(() => {
    let live = true;
    loadTokens()
      .then((data) => loadPositions(trader.address, data.tokens))
      .then((held) => live && setPositions(held))
      .catch((cause) => live && setError(String(cause)));
    fetchMarketCharts(featuredSymbols)
      .then((next) => live && setCharts(next))
      .catch(() => {});
    fetchPortfolioHistory(trader.address)
      .then((next) => live && setHistory(next))
      .catch(() => live && setHistory([]));
    return () => {
      live = false;
    };
  }, [trader.address]);

  useEffect(() => {
    if (balance === null || positions === null) return;
    const positionsValue = positions.reduce((sum, p) => sum + p.valueUsdg, 0);
    void snapshotPortfolio({ owner: trader.address, usdgBalance: balance, positionsValue }).catch(() => {});
  }, [balance, positions, trader.address]);

  const positionsValue = useMemo(
    () => (positions ?? []).reduce((sum, p) => sum + p.valueUsdg, 0),
    [positions],
  );
  const totalValue = (balance ?? 0) + positionsValue;

  const filteredHistory = useMemo(() => filterByRange(history ?? [], range), [history, range]);
  const rangeChange =
    filteredHistory.length >= 2
      ? ((filteredHistory[filteredHistory.length - 1].totalValue - filteredHistory[0].totalValue) /
          (filteredHistory[0].totalValue || 1)) *
        100
      : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Home</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Robinhood Chain</Text>
            </View>
            <Pressable onPress={refreshBalance} hitSlop={10} style={styles.heroRefresh}>
              <Text style={styles.heroRefreshText}>⟳</Text>
            </Pressable>
          </View>
          <Text style={styles.heroLabel}>Portfolio Value</Text>
          <Text style={styles.heroValue}>{usd(totalValue)}</Text>
          <View style={styles.heroBottomRow}>
            <View style={styles.heroChangeBlock}>
              <Text style={styles.heroRangeLabel}>
                {range === "1d" ? "Today" : range === "7d" ? "Past 7 days" : range === "30d" ? "Past 30 days" : "All time"} to date
              </Text>
              {rangeChange !== null ? (
                <Text
                  style={[
                    styles.heroChangeValue,
                    rangeChange >= 0 ? styles.heroChangeUp : styles.heroChangeDown,
                  ]}
                >
                  {pct(rangeChange)}
                </Text>
              ) : (
                <Text style={styles.heroChangeEmpty}>Building history…</Text>
              )}
            </View>
            <View style={styles.heroChart}>
              <Sparkline points={filteredHistory.map((s) => s.totalValue)} light compact />
            </View>
          </View>
          <View style={styles.chipRow}>
            {(["1d", "7d", "30d", "all"] as Range[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setRange(key)}
                style={[styles.heroChip, range === key && styles.heroChipActive]}
              >
                <Text style={[styles.heroChipLabel, range === key && styles.heroChipLabelActive]}>
                  {key === "1d" ? "1D" : key === "7d" ? "7D" : key === "30d" ? "1M" : "All"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.heroUpdatedAt}>Balance updated {updatedAt ?? "—"}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => onSelectTab("trade")}>
            <Text style={styles.actionLabel}>Trade</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => onSelectTab("bins")}>
            <Text style={styles.actionLabel}>Bins</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Top Assets</Text>
        <View style={styles.card}>
          {featuredSymbols.map((symbol) => {
            const chart = charts?.[symbol];
            return (
              <View key={symbol} style={styles.assetRow}>
                <AssetMark symbol={symbol} size={32} />
                <Text style={styles.assetSymbol}>{symbol}</Text>
                <View style={styles.spacer} />
                <Text style={styles.assetPrice}>{chart ? usd(chart.price) : "—"}</Text>
                <Text
                  style={[
                    styles.assetChange,
                    chart ? (chart.changePercent >= 0 ? styles.changeUp : styles.changeDown) : null,
                  ]}
                >
                  {chart ? pct(chart.changePercent) : "—"}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Ticker</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tickerRow}
        >
          {featuredSymbols.slice(0, 4).map((symbol) => {
            const chart = charts?.[symbol];
            return (
              <View key={symbol} style={styles.tickerCard}>
                <View style={styles.tickerHead}>
                  <AssetMark symbol={symbol} size={22} />
                  <Text style={styles.tickerSymbol}>{symbol}</Text>
                </View>
                <Text style={styles.tickerPrice}>{chart ? usd(chart.price) : "—"}</Text>
                <Text
                  style={[
                    styles.tickerChange,
                    chart ? (chart.changePercent >= 0 ? styles.changeUp : styles.changeDown) : null,
                  ]}
                >
                  {chart ? `${pct(chart.changePercent)} today` : "—"}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Positions</Text>
        {error !== null ? (
          <Text style={styles.error}>{error}</Text>
        ) : positions === null ? (
          <ActivityIndicator color="#090909" />
        ) : positions.length === 0 ? (
          <Text style={styles.empty}>No open positions yet. Open a bin to take a framing.</Text>
        ) : (
          <View style={styles.list}>
            {positions.map((position) => (
              <View key={position.bin.id} style={styles.positionRow}>
                <LegStack symbols={position.legs.map((leg) => leg.symbol)} size={28} />
                <View style={styles.positionIdentity}>
                  <Text style={styles.assetSymbol}>{position.bin.name}</Text>
                  <Text style={styles.muted}>{position.legs.map((leg) => leg.symbol).join(", ")}</Text>
                </View>
                <Text style={styles.assetPrice}>{usd(position.valueUsdg)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TabBar active="home" onSelect={onSelectTab} />
    </View>
  );
}

type SparklineProps = { points: number[]; light?: boolean; compact?: boolean };

function Sparkline({ points, light, compact }: SparklineProps) {
  if (points.length < 2) {
    if (compact) return null;
    return (
      <Text style={[styles.chartEmpty, light && styles.chartEmptyLight]}>
        Portfolio history builds up as you use the app — each visit adds a real data point.
      </Text>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const maxHeight = compact ? 44 : 92;
  return (
    <View style={[styles.sparkline, compact && styles.sparklineCompact]}>
      {points.map((value, i) => (
        <View
          key={i}
          style={[
            styles.sparkBar,
            light && styles.sparkBarLight,
            { height: 4 + ((value - min) / range) * maxHeight },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ededed" },
  header: {
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontFamily: family.semibold,
    fontSize: 25,
    letterSpacing: track(25, -0.04),
    color: "#0c0c0c",
  },
  iconButton: { width: 54, height: 54, borderRadius: 27 },
  content: { padding: space.lg, gap: space.lg },
  card: { padding: space.lg, borderRadius: 18, backgroundColor: "#fafafa", gap: space.sm },
  muted: { fontFamily: family.regular, fontSize: 12, color: "#858589" },

  hero: {
    padding: space.lg,
    borderRadius: 24,
    backgroundColor: "#7165ed",
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroBadgeText: { fontFamily: family.medium, fontSize: 11, color: "rgba(255,255,255,0.85)" },
  heroRefresh: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroRefreshText: { fontSize: 16, color: "#fff" },
  heroLabel: {
    fontFamily: family.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: space.lg,
  },
  heroValue: {
    fontFamily: family.semibold,
    fontSize: 38,
    letterSpacing: track(38, -0.03),
    color: "#fff",
    marginTop: 2,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: space.lg,
  },
  heroChangeBlock: { gap: 4 },
  heroRangeLabel: { fontFamily: family.regular, fontSize: 11, color: "rgba(255,255,255,0.65)" },
  heroChangeValue: { fontFamily: family.semibold, fontSize: 22, letterSpacing: track(22, -0.02) },
  heroChangeUp: { color: "#baf7c9" },
  heroChangeDown: { color: "#ffc2ba" },
  heroChangeEmpty: { fontFamily: family.regular, fontSize: 13, color: "rgba(255,255,255,0.7)" },
  heroChart: { width: 130 },
  heroChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroChipActive: { backgroundColor: "#fff" },
  heroChipLabel: { fontFamily: family.medium, fontSize: 11, color: "rgba(255,255,255,0.85)" },
  heroChipLabelActive: { color: "#131315" },
  heroUpdatedAt: {
    fontFamily: family.regular,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: space.md,
  },

  actionRow: { flexDirection: "row", gap: space.sm },
  actionButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: 14,
    backgroundColor: "#ececec",
    alignItems: "center",
  },
  actionLabel: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  sectionTitle: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
  },
  assetRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  assetSymbol: { fontFamily: family.semibold, fontSize: 14, color: "#131315" },
  spacer: { flex: 1 },
  assetPrice: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  assetChange: { fontFamily: family.regular, fontSize: 11, minWidth: 54, textAlign: "right" },
  changeUp: { color: "#1f8a4c" },
  changeDown: { color: "#c0392b" },
  tickerRow: { gap: space.md, paddingRight: space.lg },
  tickerCard: { width: 140, padding: space.md, borderRadius: 14, backgroundColor: "#fafafa", gap: 4 },
  tickerHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  tickerSymbol: { fontFamily: family.regular, fontSize: 11, color: "#858589" },
  tickerPrice: { fontFamily: family.semibold, fontSize: 17, color: "#131315" },
  tickerChange: { fontFamily: family.regular, fontSize: 11 },
  chipRow: { flexDirection: "row", gap: space.xs, marginTop: space.md },
  sparkline: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 92, marginTop: space.md },
  sparklineCompact: { height: 44, marginTop: 0 },
  sparkBar: { flex: 1, backgroundColor: "#7165ed", borderRadius: 2, minHeight: 4 },
  sparkBarLight: { backgroundColor: "rgba(255,255,255,0.85)" },
  chartEmpty: {
    fontFamily: family.regular,
    fontSize: 12,
    color: "#858589",
    textAlign: "center",
    marginTop: space.lg,
    lineHeight: 12 * 1.6,
  },
  chartEmptyLight: { color: "rgba(255,255,255,0.7)" },
  list: { borderRadius: 18, backgroundColor: "#fafafa", overflow: "hidden" },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  positionIdentity: { flex: 1, gap: 2 },
  empty: { fontFamily: family.regular, fontSize: 13, color: "#858589" },
  error: { fontFamily: family.regular, fontSize: 13, color: "#a5382a" },
});
