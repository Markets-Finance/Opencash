import { useEffect, useMemo, useState } from "react";
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
import type { BinPosition, TradingAccount } from "shared";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import {
  loadPositions,
  loadTokens,
  loadTradeAssets,
  type TradeAsset,
} from "../lib/hood";
import { family, space, track } from "../theme";

type Category = "all" | "held";

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function initial(text: string): string {
  return text.slice(0, 1).toUpperCase();
}

type TradeProps = {
  trader: TradingAccount;
  onSelectTab: (key: TabKey) => void;
  onOpenAsset: (asset: TradeAsset) => void;
};

export function Trade({ trader, onSelectTab, onOpenAsset }: TradeProps) {
  const insets = useSafeAreaInsets();
  const [positions, setPositions] = useState<BinPosition[] | null>(null);
  const [assets, setAssets] = useState<TradeAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");

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

  // "Held" reflects legs inside your open bins — a token bought directly
  // from this tab isn't tracked here yet, only basket positions are.
  const heldSymbols = useMemo(
    () =>
      new Set(
        (positions ?? []).flatMap((position) => position.legs.map((leg) => leg.symbol)),
      ),
    [positions],
  );

  const filteredAssets = useMemo(() => {
    if (assets === null) return null;
    const q = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (category === "held" && !heldSymbols.has(asset.token.symbol)) return false;
      if (q === "") return true;
      return (
        asset.token.symbol.toLowerCase().includes(q) ||
        asset.token.name.toLowerCase().includes(q)
      );
    });
  }, [assets, query, category, heldSymbols]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Trade</Text>
        <Pressable
          hitSlop={12}
          onPress={() => setSearching((current) => !current)}
          style={[styles.iconButton, searching && styles.iconButtonActive]}
        >
          <Text style={styles.search}>⌕</Text>
        </Pressable>
      </View>

      {searching && (
        <View style={styles.searchBar}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search symbol or name"
            placeholderTextColor="#b3b3b6"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {error !== null ? (
          <Text style={styles.error}>{error}</Text>
        ) : positions === null ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#090909" />
            <Text style={styles.loadingLabel}>Reading your positions</Text>
          </View>
        ) : (
          <>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Open positions</Text>
              <Text style={styles.totalValue}>{usd(totalValue)}</Text>
            </View>

            {positions.length === 0 ? (
              <Text style={styles.empty}>
                No open positions yet. Open a bin to take a framing.
              </Text>
            ) : (
              <View style={styles.grid}>
                {positions.map((position) => (
                  <View key={position.bin.id} style={styles.card}>
                    <View style={styles.assetMark}>
                      <Text style={styles.assetMarkText}>
                        {initial(position.bin.name)}
                      </Text>
                    </View>
                    <Text style={styles.binName}>{position.bin.name}</Text>
                    <Text style={styles.binValue}>{usd(position.valueUsdg)}</Text>
                    {position.legs.map((leg) => (
                      <View key={leg.symbol} style={styles.legRow}>
                        <Text style={styles.legSymbol}>{leg.symbol}</Text>
                        <View style={styles.spacer} />
                        <Text style={styles.legValue}>{usd(leg.valueUsdg)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Available to trade</Text>
            <View style={styles.categoryRow}>
              {(
                [
                  ["all", "All"],
                  ["held", "Held"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setCategory(key)}
                  style={[styles.categoryTab, category === key && styles.categoryTabActive]}
                >
                  <Text
                    style={[
                      styles.categoryLabel,
                      category === key && styles.categoryLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {filteredAssets === null ? (
              <ActivityIndicator color="#090909" />
            ) : filteredAssets.length === 0 ? (
              <Text style={styles.empty}>
                {category === "held"
                  ? "No direct holdings from a bin yet."
                  : "No tokens match that search."}
              </Text>
            ) : (
              <View style={styles.list}>
                {filteredAssets.map((asset) => (
                  <Pressable
                    key={asset.token.symbol}
                    onPress={() => onOpenAsset(asset)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={styles.rowMark}>
                      <Text style={styles.rowMarkText}>{initial(asset.token.symbol)}</Text>
                    </View>
                    <View style={styles.rowIdentity}>
                      <Text style={styles.assetSymbol}>{asset.token.symbol}</Text>
                      <Text style={styles.assetName} numberOfLines={1}>
                        {asset.token.name}
                      </Text>
                    </View>
                    <Text style={styles.assetPrice}>
                      {asset.price === null
                        ? "—"
                        : asset.halted
                          ? "Halted"
                          : usd(asset.price)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TabBar active="trade" onSelect={onSelectTab} />
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
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#f8f8f8",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: { backgroundColor: "#e4e4e4" },
  search: {
    fontFamily: family.light,
    fontSize: 33,
    lineHeight: 36,
    color: "#55555a",
    transform: [{ rotate: "-20deg" }],
  },
  searchBar: { paddingHorizontal: space.lg, marginTop: space.md },
  searchInput: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 14,
    backgroundColor: "#f8f8f8",
    fontFamily: family.regular,
    fontSize: 15,
    color: "#131315",
  },
  categoryRow: { flexDirection: "row", gap: space.sm },
  categoryTab: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 999,
    backgroundColor: "#f0f0f0",
  },
  categoryTabActive: { backgroundColor: "#090909" },
  categoryLabel: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  categoryLabelActive: { color: "#fff" },
  content: { padding: space.lg, gap: space.lg },
  loading: { paddingVertical: space.block, alignItems: "center", gap: space.md },
  loadingLabel: { fontFamily: family.regular, fontSize: 13, color: "#77777a" },
  error: { fontFamily: family.regular, fontSize: 13, color: "#a5382a" },
  totalCard: {
    padding: space.lg,
    borderRadius: 18,
    backgroundColor: "#fafafa",
    gap: space.xs,
  },
  totalLabel: { fontFamily: family.regular, fontSize: 12, color: "#858589" },
  totalValue: {
    fontFamily: family.semibold,
    fontSize: 28,
    letterSpacing: track(28, -0.03),
    color: "#0c0c0c",
  },
  empty: {
    fontFamily: family.regular,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#858589",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  card: {
    width: "48%",
    padding: space.md,
    borderRadius: 18,
    backgroundColor: "#fafafa",
    gap: space.sm,
  },
  assetMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#090909",
    alignItems: "center",
    justifyContent: "center",
  },
  assetMarkText: { fontFamily: family.semibold, fontSize: 18, color: "#fff" },
  binName: {
    fontFamily: family.semibold,
    fontSize: 15,
    letterSpacing: track(15, -0.03),
    color: "#131315",
  },
  binValue: { fontFamily: family.medium, fontSize: 13, color: "#4e4e51" },
  legRow: { flexDirection: "row", alignItems: "center" },
  legSymbol: { fontFamily: family.medium, fontSize: 11, color: "#79797d" },
  spacer: { flex: 1 },
  legValue: { fontFamily: family.regular, fontSize: 11, color: "#4e4e51" },
  sectionTitle: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
  },
  list: { borderRadius: 18, backgroundColor: "#fafafa", overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  rowPressed: { backgroundColor: "#f2f2f2" },
  rowMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#e8e8e8",
    alignItems: "center",
    justifyContent: "center",
  },
  rowMarkText: { fontFamily: family.semibold, fontSize: 14, color: "#1b1b1d" },
  rowIdentity: { flex: 1, minWidth: 0 },
  assetSymbol: { fontFamily: family.semibold, fontSize: 14, color: "#131315" },
  assetName: { fontFamily: family.regular, fontSize: 12, color: "#858589" },
  assetPrice: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
});
