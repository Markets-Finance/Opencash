import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bins, type BinPosition, type TradingAccount } from "shared";
import { AssetMark, LegStack } from "../components/AssetMark";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { loadMarkets, loadPositions, loadSummary, type MarketData, type PortfolioSummary } from "../lib/perpl";
import { dark, family, space, touch, track } from "../theme";

const featuredSymbols = [...new Set(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)))];

type HomeProps = {
  trader: TradingAccount;
  onSelectTab: (key: TabKey) => void;
};

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function money(value: number): { whole: string; cents: string } {
  const [whole, cents] = Math.abs(value)
    .toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(".");
  return { whole: `${value < 0 ? "−" : ""}$${whole}`, cents: `.${cents}` };
}

export function Home({ trader, onSelectTab }: HomeProps) {
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<BinPosition[] | null>(null);
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadMarkets()
      .then((markets) => {
        if (live) setData(markets);
        loadSummary(trader.address, markets).then((next) => live && setSummary(next)).catch(() => live && setSummary(null));
        return loadPositions(trader.address, markets);
      })
      .then((held) => live && setPositions(held))
      .catch((cause) => live && setError(String(cause)));
    return () => {
      live = false;
    };
  }, [trader.address]);

  const total = money(summary?.total ?? 0);
  const pnl = summary?.unrealizedPnl ?? 0;
  const change = money(Math.abs(pnl));

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
        <View style={styles.wallet}>
          <View style={styles.walletFace}>
            <View style={[styles.dot, styles.dotTopLeft]} />
            <View style={[styles.dot, styles.dotTopRight]} />
            <View style={[styles.dot, styles.dotBottomLeft]} />
            <View style={[styles.dot, styles.dotBottomRight]} />
            <View style={styles.coinStack}>
              {(summary?.symbols.length ? summary.symbols : featuredSymbols).slice(0, 4).map((coin, index) => (
                <CoinMark key={coin} coin={coin} first={index === 0} />
              ))}
            </View>
            <Text style={styles.walletBalance} numberOfLines={1} adjustsFontSizeToFit>
              {total.whole}
              <Text style={styles.walletCents}>{total.cents}</Text>
            </Text>
            <Text style={styles.walletChange}>
              {pnl >= 0 ? "+" : "−"} {change.whole}
              {change.cents}
            </Text>
          </View>
          <View style={styles.walletActions}>
            <Pressable style={styles.walletAction} onPress={() => onSelectTab("trade")}>
              <Text style={styles.walletIcon}>⟳</Text>
              <Text style={styles.walletActionLabel}>Swap</Text>
            </Pressable>
            <View style={styles.walletDivider} />
            <Pressable style={styles.walletAction} onPress={() => onSelectTab("trade")}>
              <View style={styles.sendIcon}>
                <Text style={styles.walletIcon}>↑</Text>
                <View style={styles.sendBar} />
              </View>
              <Text style={styles.walletActionLabel}>Send</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => onSelectTab("trade")}>
            <Text style={styles.actionLabel}>Trade</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => onSelectTab("bins")}>
            <Text style={styles.actionLabel}>Bins</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Markets</Text>
        <View style={styles.card}>
          {featuredSymbols.map((symbol) => {
            const mark = data?.markets.get(symbol)?.mark;
            return (
              <View key={symbol} style={styles.assetRow}>
                <AssetMark symbol={symbol} size={32} />
                <Text style={styles.assetSymbol}>{symbol}</Text>
                <View style={styles.spacer} />
                <Text style={styles.assetPrice}>{mark === undefined ? "—" : usd(mark)}</Text>
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
            const mark = data?.markets.get(symbol)?.mark;
            return (
              <View key={symbol} style={styles.tickerCard}>
                <View style={styles.tickerHead}>
                  <AssetMark symbol={symbol} size={22} />
                  <Text style={styles.tickerSymbol}>{symbol}</Text>
                </View>
                <Text style={styles.tickerPrice}>{mark === undefined ? "—" : usd(mark)}</Text>
              </View>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Positions</Text>
        {error !== null ? (
          <Text style={styles.error}>{error}</Text>
        ) : positions === null ? (
          <ActivityIndicator color={dark.ink} />
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
                <Text style={styles.assetPrice}>{usd(position.deposit + position.pnl)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TabBar active="home" onSelect={onSelectTab} />
    </View>
  );
}

type CoinMarkProps = { coin: string; first: boolean };

function CoinMark({ coin, first }: CoinMarkProps) {
  return (
    <View style={[styles.coin, !first && styles.coinOverlap]}>
      <Text style={styles.coinLetter}>{coin.slice(0, 1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
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
    color: dark.ink,
  },
  iconButton: { width: 54, height: 54, borderRadius: 27 },
  content: { padding: space.lg, gap: space.lg },
  card: { padding: space.lg, borderRadius: space.lg, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.surfaceLine, gap: space.sm },
  muted: { fontFamily: family.regular, fontSize: 12, color: dark.muted },

  wallet: {
    padding: space.md,
    borderRadius: space.xl + space.md,
    borderWidth: 1,
    borderColor: dark.surfaceLine,
    backgroundColor: dark.wallet,
  },
  walletFace: {
    alignItems: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    borderRadius: space.xl,
    backgroundColor: dark.lime,
  },
  dot: {
    position: "absolute",
    width: space.sm,
    height: space.sm,
    borderRadius: space.xs,
    backgroundColor: dark.wallet,
  },
  dotTopLeft: { top: space.xl, left: space.xl },
  dotTopRight: { top: space.xl, right: space.xl },
  dotBottomLeft: { bottom: space.xl, left: space.xl },
  dotBottomRight: { bottom: space.xl, right: space.xl },
  coinStack: { flexDirection: "row" },
  coin: {
    width: space.xxl,
    height: space.xxl,
    borderRadius: space.xxl / 2,
    borderWidth: 2,
    borderColor: dark.wallet,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coinOverlap: { marginLeft: -space.xs },
  coinImage: { width: "100%", height: "100%" },
  coinLetter: { fontFamily: family.semibold, fontSize: 14, color: dark.wallet },
  walletBalance: {
    fontFamily: family.semibold,
    fontSize: 56,
    letterSpacing: track(56, -0.05),
    color: dark.limeInk,
    marginTop: space.md,
  },
  walletCents: { fontSize: 30, letterSpacing: track(30, -0.03) },
  walletChange: {
    fontFamily: family.medium,
    fontSize: 22,
    letterSpacing: track(22, -0.02),
    color: dark.limeInk,
    marginTop: space.sm,
  },
  walletActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.xxl,
  },
  walletAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  walletIcon: { fontSize: 24, lineHeight: 28, color: dark.onWallet },
  sendIcon: { alignItems: "center" },
  sendBar: { width: space.lg, height: 2, borderRadius: 1, backgroundColor: dark.onWallet },
  walletActionLabel: { fontFamily: family.medium, fontSize: 24, color: dark.onWallet },
  walletDivider: { width: 1, height: space.section, backgroundColor: dark.line },

  actionRow: { flexDirection: "row", gap: space.sm },
  actionButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: 14,
    minHeight: touch,
    justifyContent: "center",
    backgroundColor: dark.surfaceHover,
    alignItems: "center",
  },
  actionLabel: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
  sectionTitle: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: dark.muted,
  },
  assetRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  assetSymbol: { fontFamily: family.semibold, fontSize: 14, color: dark.ink },
  spacer: { flex: 1 },
  assetPrice: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
  assetChange: { fontFamily: family.regular, fontSize: 11, minWidth: 54, textAlign: "right" },
  changeUp: { color: dark.green },
  changeDown: { color: dark.red },
  tickerRow: { gap: space.md, paddingRight: space.lg },
  tickerCard: { width: 140, padding: space.md, borderRadius: space.md, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.surfaceLine, gap: space.xs },
  tickerHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  tickerSymbol: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  tickerPrice: { fontFamily: family.semibold, fontSize: 17, color: dark.ink },
  tickerChange: { fontFamily: family.regular, fontSize: 11 },
  list: { borderRadius: space.lg, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.surfaceLine, overflow: "hidden" },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  positionIdentity: { flex: 1, gap: 2 },
  empty: { fontFamily: family.regular, fontSize: 13, color: dark.muted },
  error: { fontFamily: family.regular, fontSize: 13, color: dark.red },
});
