import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bins, type Bin } from "shared";
import { LegStack } from "../components/AssetMark";
import { Ranks } from "../components/Ranks";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { ArrowBadge, ScreenTitle, SelectPill, tone } from "../components/ui";
import { loadMarkets, type MarketData } from "../lib/perpl";
import { dark, family, space, touch } from "../theme";

const fills = [tone.butter, tone.coral, tone.violet, tone.lime, tone.sky, tone.peach];

type BinsProps = {
  onOpen: (bin: Bin, data: MarketData) => void;
  onComplete: () => void;
  onSelectTab: (key: TabKey) => void;
};

export function Bins({ onOpen, onComplete, onSelectTab }: BinsProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([bins[0].id, bins[1].id]);
  const [view, setView] = useState<"bins" | "ranks">("bins");

  useEffect(() => {
    let live = true;
    loadMarkets().then((result) => live && setData(result)).catch(() => live && setError("Markets are unavailable right now."));
    return () => {
      live = false;
    };
  }, []);

  function toggle(bin: Bin) {
    setSelected((current) => (current.includes(bin.id) ? current.filter((id) => id !== bin.id) : [...current, bin.id]));
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + tabBarHeight + (view === "bins" ? 112 : space.xl) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title={view === "bins" ? "Bins" : "Ranks"} />
        <View style={styles.pills}>
          <SelectPill label="Bins" active={view === "bins"} onPress={() => setView("bins")} />
          <SelectPill label="Ranks" active={view === "ranks"} onPress={() => setView("ranks")} />
        </View>

        {view === "ranks" ? (
          <Ranks />
        ) : (
          <>
            <Text style={styles.intro}>Each bin is a theme traded as a basket of Perpl perps. Tap + to keep one close, ↗ to open it.</Text>
            {error !== null ? (
              <Text style={styles.error}>{error}</Text>
            ) : data === null ? (
              <View style={styles.loading}>
                <ActivityIndicator color={dark.ink} />
                <Text style={styles.muted}>Loading markets</Text>
              </View>
            ) : (
              bins.map((bin, index) => {
                const active = selected.includes(bin.id);
                const lead = bin.legs[0];
                const price = data.markets.get(lead.symbol)?.mark;
                return (
                  <View key={bin.id} style={[styles.card, { backgroundColor: fills[index % fills.length] }]}>
                    <View style={styles.cardHead}>
                      <Text style={styles.name}>{bin.name.toUpperCase()}</Text>
                      <ArrowBadge dark label={`Open ${bin.name}`} onPress={() => onOpen(bin, data)} />
                    </View>
                    <Text style={styles.thesis} numberOfLines={2}>
                      {bin.thesis}
                    </Text>
                    <View style={styles.legs}>
                      {bin.legs.map((leg) => (
                        <View key={`${leg.symbol}-${leg.direction}`} style={styles.leg}>
                          <View style={[styles.legDot, { backgroundColor: leg.direction === "long" ? "#1f9d55" : "#d64545" }]} />
                          <Text style={styles.legText}>
                            {leg.direction === "long" ? "Long" : "Short"} {leg.symbol} {(leg.weightBps / 100).toFixed(0)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.cardFoot}>
                      <LegStack symbols={bin.legs.map((leg) => leg.symbol)} size={34} />
                      <Text style={styles.price}>
                        {lead.symbol} {price === undefined ? "—" : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      </Text>
                      <Pressable
                        onPress={() => toggle(bin)}
                        accessibilityLabel={active ? `Remove ${bin.name}` : `Keep ${bin.name}`}
                        style={({ pressed }) => [styles.add, active && styles.addActive, pressed && styles.pressed]}
                      >
                        <Text style={[styles.addLabel, active && styles.addLabelActive]}>{active ? "✓" : "+"}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {view === "bins" && (
        <View style={[styles.footer, { bottom: tabBarHeight + insets.bottom }]}>
          <Pressable onPress={onComplete} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryLabel}>Keep {selected.length} bin{selected.length === 1 ? "" : "s"} close</Text>
          </Pressable>
        </View>
      )}
      <TabBar active="bins" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  pills: { flexDirection: "row", gap: space.sm },
  intro: { fontFamily: family.regular, fontSize: 14, lineHeight: 21, color: dark.muted },
  muted: { fontFamily: family.regular, fontSize: 13, color: dark.muted },
  error: { fontFamily: family.regular, fontSize: 13, color: dark.red },
  loading: { paddingVertical: space.block, alignItems: "center", gap: space.md },
  card: { borderRadius: 28, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  name: { flex: 1, fontFamily: family.semibold, fontSize: 26, lineHeight: 28, letterSpacing: -1, color: tone.ink },
  thesis: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: "rgba(20, 24, 26, 0.75)" },
  legs: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  leg: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingVertical: 4, paddingHorizontal: space.sm, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.6)" },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legText: { fontFamily: family.medium, fontSize: 12, color: tone.ink },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: space.md },
  price: { flex: 1, fontFamily: family.medium, fontSize: 14, color: tone.ink },
  add: { width: touch, height: touch, borderRadius: touch / 2, backgroundColor: "rgba(20, 24, 26, 0.15)", alignItems: "center", justifyContent: "center" },
  addActive: { backgroundColor: tone.ink },
  addLabel: { fontFamily: family.medium, fontSize: 22, color: tone.ink },
  addLabelActive: { fontSize: 17, color: tone.paper },
  pressed: { opacity: 0.75 },
  footer: { position: "absolute", left: 0, right: 0, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: dark.paper },
  primary: { minHeight: 56, borderRadius: 999, backgroundColor: tone.coral, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontFamily: family.semibold, fontSize: 16, color: tone.ink },
});
