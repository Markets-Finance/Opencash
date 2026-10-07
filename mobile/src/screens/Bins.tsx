import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bins, type Bin } from "shared";
import { AssetMark } from "../components/AssetMark";
import { Ranks } from "../components/Ranks";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { loadMarkets, type MarketData } from "../lib/perpl";
import { dark, family, space, touch, track } from "../theme";

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
  const [view, setView] = useState<'bins' | 'ranks'>('bins');

  useEffect(() => {
    let live = true;
    loadMarkets().then((result) => live && setData(result)).catch(() => live && setError("Markets are unavailable right now."));
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
        {['Picks', 'Majors', 'Layer ones', 'Spreads', 'Ranks'].map((tab) => {
          const active = tab === 'Ranks' ? view === 'ranks' : view === 'bins' && tab === 'Picks';
          return <Pressable key={tab} onPress={() => setView(tab === 'Ranks' ? 'ranks' : 'bins')} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{tab}</Text></Pressable>;
        })}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + tabBarHeight + 112 }]} showsVerticalScrollIndicator={false}>
        {view === 'ranks' ? <Ranks /> : <Text style={styles.intro}>Choose the markets you want to keep close.</Text>}
        {view === 'ranks' ? null : error !== null ? <Text style={styles.error}>{error}</Text> : data === null ? <View style={styles.loading}><ActivityIndicator color={dark.ink} /><Text style={styles.loadingLabel}>Loading markets</Text></View> : <View style={styles.grid}>
          {bins.map((bin) => {
            const active = selected.includes(bin.id);
            const lead = bin.legs[0];
            const price = data.markets.get(lead.symbol)?.mark;
            return <Pressable key={bin.id} onPress={() => toggle(bin)} onLongPress={() => onOpen(bin, data)} style={({ pressed }) => [styles.card, active && styles.cardActive, pressed && styles.cardPressed]}>
              <View style={styles.assetMark}><AssetMark symbol={lead.symbol} size={48} /></View>
              <Text style={styles.symbol}>{lead.symbol}<Text style={styles.quote}> / AUSD</Text></Text>
              <Text style={styles.marketName}>{bin.name}</Text>
              <Text style={styles.price}>{price === undefined ? 'Market price' : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</Text>
              <View style={[styles.add, active && styles.addActive]}><Text style={[styles.addLabel, active && styles.addLabelActive]}>{active ? '✓' : '+'}</Text></View>
            </Pressable>;
          })}
        </View>}
      </ScrollView>

      {view === 'bins' && <View style={[styles.footer, { bottom: tabBarHeight + insets.bottom }]}>
        <Pressable onPress={onComplete} style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]}><Text style={styles.primaryLabel}>Add to Favorites</Text></Pressable>
        <Pressable onPress={onComplete} hitSlop={12}><Text style={styles.other}>Add other pairs</Text></Pressable>
      </View>}
      <TabBar active="bins" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  header: { paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: family.semibold, fontSize: 25, letterSpacing: track(25, -0.04), color: dark.ink },
  iconButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: dark.surface, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontFamily: family.light, fontSize: 39, lineHeight: 42, color: dark.muted, marginTop: -5 },
  search: { fontFamily: family.light, fontSize: 33, lineHeight: 36, color: dark.muted, transform: [{ rotate: '-20deg' }] },
  tabs: { flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.lg, backgroundColor: dark.surface, borderRadius: 28, padding: 3 },
  tab: { flex: 1, minHeight: touch, justifyContent: 'center', alignItems: 'center', borderRadius: 24 },
  activeTab: { backgroundColor: dark.surfaceHover },
  tabLabel: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  activeTabLabel: { fontFamily: family.medium, color: dark.ink },
  content: { padding: space.lg, gap: space.lg },
  intro: { fontFamily: family.regular, fontSize: 14, lineHeight: 20, color: dark.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { width: '48%', minHeight: 190, padding: space.md, borderRadius: space.lg, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.surfaceLine, justifyContent: 'flex-end', overflow: 'hidden' },
  cardActive: { borderColor: dark.accent },
  cardPressed: { opacity: 0.7 },
  assetMark: { position: 'absolute', top: space.md, left: space.md },
  symbol: { fontFamily: family.semibold, fontSize: 19, letterSpacing: track(19, -0.04), color: dark.ink },
  quote: { fontFamily: family.regular, fontSize: 10, color: dark.muted },
  marketName: { fontFamily: family.regular, fontSize: 12, color: dark.muted, marginTop: space.xs },
  price: { fontFamily: family.medium, fontSize: 12, color: dark.ink, marginTop: space.sm },
  add: { position: 'absolute', right: space.sm, bottom: space.sm, width: touch, height: touch, borderRadius: space.md, backgroundColor: dark.surfaceHover, alignItems: 'center', justifyContent: 'center' },
  addActive: { backgroundColor: dark.accent },
  addLabel: { fontFamily: family.regular, fontSize: 29, lineHeight: 32, color: dark.ink },
  addLabelActive: { fontSize: 19, color: dark.onAccent },
  loading: { paddingVertical: space.block, alignItems: 'center', gap: space.md },
  loadingLabel: { fontFamily: family.regular, fontSize: 13, color: dark.muted },
  error: { fontFamily: family.regular, fontSize: 13, color: dark.red },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: dark.paper, gap: space.sm },
  primaryButton: { minHeight: 64, borderRadius: 33, backgroundColor: dark.accent, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: family.medium, fontSize: 16, color: dark.onAccent },
  other: { fontFamily: family.regular, fontSize: 15, color: dark.muted, textAlign: 'center' },
});
