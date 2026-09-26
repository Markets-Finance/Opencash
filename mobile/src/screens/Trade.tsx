import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BinPosition, TradingAccount } from "shared";
import { DashedRule } from "../components/DashedRule";
import { Diamond } from "../components/Diamond";
import { SectionLabel } from "../components/SectionLabel";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import {
  loadPositions,
  loadTokens,
  loadTradeAssets,
  type TradeAsset,
} from "../lib/hood";
import { color, family, space, track } from "../theme";

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

type TradeProps = {
  trader: TradingAccount;
  onSelectTab: (key: TabKey) => void;
};

export function Trade({ trader, onSelectTab }: TradeProps) {
  const insets = useSafeAreaInsets();
  const [positions, setPositions] = useState<BinPosition[] | null>(null);
  const [assets, setAssets] = useState<TradeAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadTokens()
      .then(async (data) => {
        const [held, tradeable] = await Promise.all([
          loadPositions(trader.address, data.tokens),
          loadTradeAssets(data.tokens),
        ]);
        if (!live) return;
        setPositions(held);
        setAssets(tradeable);
      })
      .catch((cause) => live && setError(String(cause)));
    return () => {
      live = false;
    };
  }, [trader.address]);

  const totalValue = (positions ?? []).reduce(
    (sum, position) => sum + position.valueUsdg,
    0,
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.xl,
            paddingBottom: tabBarHeight + insets.bottom + space.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel>TRADE</SectionLabel>
        <Text style={styles.title}>What you hold.</Text>

        {error !== null ? (
          <Text style={styles.error}>{error}</Text>
        ) : positions === null ? (
          <View style={styles.loading}>
            <ActivityIndicator color={color.purple} />
            <Text style={styles.loadingLabel}>Reading your positions…</Text>
          </View>
        ) : (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Open positions</Text>
              <Text style={styles.totalValue}>{usd(totalValue)}</Text>
            </View>

            <DashedRule />

            {positions.length === 0 ? (
              <Text style={styles.empty}>
                No open positions yet. Open a bin to take a framing.
              </Text>
            ) : (
              positions.map((position) => (
                <View key={position.bin.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.binName}>{position.bin.name}</Text>
                    <Text style={styles.binValue}>
                      {usd(position.valueUsdg)}
                    </Text>
                  </View>
                  {position.legs.map((leg) => (
                    <View key={leg.symbol} style={styles.legRow}>
                      <Diamond size={5} fill={color.purple} />
                      <Text style={styles.legSymbol}>{leg.symbol}</Text>
                      <View style={styles.spacer} />
                      <Text style={styles.legShares}>
                        {leg.shares.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}
                      </Text>
                      <Text style={styles.legValue}>{usd(leg.valueUsdg)}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}

            <DashedRule />

            <Text style={styles.sectionTitle}>Available to trade</Text>
            {assets === null ? (
              <ActivityIndicator color={color.purple} />
            ) : (
              assets.map((asset) => (
                <View key={asset.token.symbol} style={styles.assetRow}>
                  <Text style={styles.assetSymbol}>{asset.token.symbol}</Text>
                  <Text style={styles.assetName} numberOfLines={1}>
                    {asset.token.name}
                  </Text>
                  <Text style={styles.assetPrice}>
                    {asset.price === null ? "—" : usd(asset.price)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <TabBar active="trade" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { paddingHorizontal: space.xl, gap: space.lg },
  title: {
    fontFamily: family.light,
    fontSize: 30,
    lineHeight: 30 * 1.18,
    letterSpacing: track(30, -0.04),
    color: color.ink,
  },
  loading: { paddingVertical: space.section, alignItems: "center", gap: space.md },
  loadingLabel: { fontFamily: family.light, fontSize: 13, color: "#6f6d6a" },
  error: { fontFamily: family.light, fontSize: 13, color: "#a5382a" },
  totalRow: { flexDirection: "row", alignItems: "baseline" },
  totalLabel: {
    flex: 1,
    fontFamily: family.light,
    fontSize: 13,
    color: "#6f6d6a",
  },
  totalValue: {
    fontFamily: family.regular,
    fontSize: 24,
    letterSpacing: track(24, -0.03),
    color: color.ink,
  },
  empty: {
    fontFamily: family.light,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#8a8884",
  },
  card: {
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: "#fdfcfa",
    padding: space.lg,
    gap: space.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "baseline" },
  binName: {
    flex: 1,
    fontFamily: family.medium,
    fontSize: 16,
    letterSpacing: track(16, -0.03),
    color: color.ink,
  },
  binValue: { fontFamily: family.regular, fontSize: 15, color: color.ink },
  legRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  legSymbol: {
    fontFamily: family.medium,
    fontSize: 13,
    color: color.ink,
    minWidth: 56,
  },
  spacer: { flex: 1 },
  legShares: {
    fontFamily: family.light,
    fontSize: 12,
    color: "#6f6d6a",
    minWidth: 72,
    textAlign: "right",
  },
  legValue: {
    fontFamily: family.regular,
    fontSize: 12,
    color: color.ink,
    minWidth: 68,
    textAlign: "right",
  },
  sectionTitle: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#8a8884",
  },
  assetRow: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  assetSymbol: {
    fontFamily: family.medium,
    fontSize: 14,
    color: color.ink,
    minWidth: 66,
  },
  assetName: {
    flex: 1,
    fontFamily: family.light,
    fontSize: 12,
    color: "#8a8884",
  },
  assetPrice: { fontFamily: family.regular, fontSize: 13, color: color.ink },
});
