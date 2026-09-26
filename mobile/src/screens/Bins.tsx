import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bins, type Bin } from "shared";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { loadTokens, type HoodData } from "../lib/hood";
import { color, family, space, track } from "../theme";

type BinsProps = {
  onOpen: (bin: Bin, data: HoodData) => void;
  onComplete: () => void;
  onSelectTab: (key: TabKey) => void;
};

export function Bins({ onOpen, onComplete, onSelectTab }: BinsProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HoodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([bins[0].id, bins[1].id]);

  useEffect(() => {
    let live = true;
    loadTokens().then((result) => live && setData(result)).catch(() => live && setError("Markets are unavailable right now."));
    return () => { live = false; };
  }, []);

  function toggle(bin: Bin) {
    setSelected((current) => current.includes(bin.id) ? current.filter((id) => id !== bin.id) : [...current, bin.id]);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.iconButton} />
        <Text style={styles.heading}>Markets</Text>
        <Pressable hitSlop={12} style={styles.iconButton}><Text style={styles.search}>⌕</Text></Pressable>
      </View>

      <View style={styles.tabs}>
        {['Picks', 'Stocks', 'Futures', 'RWA', 'Ranks'].map((tab, index) => <View key={tab} style={[styles.tab, index === 0 && styles.activeTab]}><Text style={[styles.tabLabel, index === 0 && styles.activeTabLabel]}>{tab}</Text></View>)}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + tabBarHeight + 112 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Choose the markets you want to keep close.</Text>
        {error !== null ? <Text style={styles.error}>{error}</Text> : data === null ? <View style={styles.loading}><ActivityIndicator color="#090909" /><Text style={styles.loadingLabel}>Loading markets</Text></View> : <View style={styles.grid}>
          {bins.map((bin) => {
            const active = selected.includes(bin.id);
            const lead = bin.legs[0];
            const price = data.price.get(lead.symbol);
            return <Pressable key={bin.id} onPress={() => toggle(bin)} onLongPress={() => onOpen(bin, data)} style={({ pressed }) => [styles.card, active && styles.cardActive, pressed && styles.cardPressed]}>
              <View style={styles.assetMark}><Text style={styles.assetMarkText}>{lead.symbol.slice(0, 1)}</Text></View>
              <Text style={styles.symbol}>{lead.symbol}<Text style={styles.quote}> / USDG</Text></Text>
              <Text style={styles.marketName}>{bin.name}</Text>
              <Text style={styles.price}>{price === undefined ? 'Market price' : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</Text>
              <View style={[styles.add, active && styles.addActive]}><Text style={[styles.addLabel, active && styles.addLabelActive]}>{active ? '✓' : '+'}</Text></View>
            </Pressable>;
          })}
        </View>}
      </ScrollView>

      <View style={[styles.footer, { bottom: tabBarHeight + insets.bottom }]}>
        <Pressable onPress={onComplete} style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]}><Text style={styles.primaryLabel}>Add to Favorites</Text></Pressable>
        <Pressable onPress={onComplete} hitSlop={12}><Text style={styles.other}>Add other pairs</Text></Pressable>
      </View>
      <TabBar active="bins" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ededed' },
  header: { paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: family.semibold, fontSize: 25, letterSpacing: track(25, -0.04), color: '#0c0c0c' },
  iconButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#f8f8f8', alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontFamily: family.light, fontSize: 39, lineHeight: 42, color: '#6e6e70', marginTop: -5 },
  search: { fontFamily: family.light, fontSize: 33, lineHeight: 36, color: '#55555a', transform: [{ rotate: '-20deg' }] },
  tabs: { flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.lg, backgroundColor: '#f8f8f8', borderRadius: 28, padding: 3 },
  tab: { flex: 1, minHeight: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 24 },
  activeTab: { backgroundColor: '#e8e8e8' },
  tabLabel: { fontFamily: family.regular, fontSize: 11, color: '#79797d' },
  activeTabLabel: { fontFamily: family.medium, color: '#1b1b1d' },
  content: { padding: space.lg, gap: space.lg },
  intro: { fontFamily: family.regular, fontSize: 14, lineHeight: 20, color: '#77777a' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { width: '48%', minHeight: 190, padding: space.md, borderRadius: 18, backgroundColor: '#fafafa', justifyContent: 'flex-end', overflow: 'hidden' },
  cardActive: { borderWidth: 1.5, borderColor: '#111' },
  cardPressed: { opacity: 0.7 },
  assetMark: { position: 'absolute', top: space.md, left: space.md, width: 48, height: 48, borderRadius: 15, backgroundColor: '#090909', alignItems: 'center', justifyContent: 'center' },
  assetMarkText: { fontFamily: family.semibold, fontSize: 24, color: '#fff' },
  symbol: { fontFamily: family.semibold, fontSize: 19, letterSpacing: track(19, -0.04), color: '#131315' },
  quote: { fontFamily: family.regular, fontSize: 10, color: '#8a8a8d' },
  marketName: { fontFamily: family.regular, fontSize: 12, color: '#858589', marginTop: 3 },
  price: { fontFamily: family.medium, fontSize: 12, color: '#4e4e51', marginTop: space.sm },
  add: { position: 'absolute', right: space.sm, bottom: space.sm, width: 39, height: 39, borderRadius: 13, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  addActive: { backgroundColor: '#090909' },
  addLabel: { fontFamily: family.regular, fontSize: 29, lineHeight: 32, color: '#121212' },
  addLabelActive: { fontSize: 19, color: '#fff' },
  loading: { paddingVertical: space.block, alignItems: 'center', gap: space.md },
  loadingLabel: { fontFamily: family.regular, fontSize: 13, color: '#77777a' },
  error: { fontFamily: family.regular, fontSize: 13, color: '#a5382a' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: 'rgba(237,237,237,0.96)', gap: space.sm },
  primaryButton: { minHeight: 64, borderRadius: 33, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: family.medium, fontSize: 16, color: '#fff' },
  other: { fontFamily: family.regular, fontSize: 15, color: '#858589', textAlign: 'center' },
});
