import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LegStack } from "./AssetMark";
import { tone } from "./ui";
import { family, space } from "../theme";

type Slide = { title: string; lead: string; bold: string; tail: string; color: string; art: "bins" | "strategies" | "trade" };

const slides: Slide[] = [
  { title: "Back a\nTheme", lead: "Pick a bin like", bold: "Satoshi's Lovers", tail: "and open every coin in it with one tap and one transaction.", color: tone.lime, art: "bins" },
  { title: "Let Rules\nTrade", lead: "Test a strategy on", bold: "real history", tail: "first. Then let a bot run it with a stop and a cap you choose.", color: tone.butter, art: "strategies" },
  { title: "Trade\nDirect", lead: "Open a long or short on any Perpl market with", bold: "your AUSD", tail: "and see entry, stop and liquidation on the chart.", color: tone.peach, art: "trade" },
];

const ink = tone.ink;

function Art({ kind }: { kind: Slide["art"] }) {
  if (kind === "bins") {
    return (
      <View style={styles.art}>
        <LegStack symbols={["BTC", "ETH", "SOL", "HYPE"]} size={64} />
        <View style={styles.weights}>
          <View style={[styles.weight, { flex: 4, backgroundColor: ink }]} />
          <View style={[styles.weight, { flex: 3, backgroundColor: tone.violet }]} />
          <View style={[styles.weight, { flex: 2, backgroundColor: tone.coral }]} />
          <View style={[styles.weight, { flex: 1, backgroundColor: tone.card }]} />
        </View>
      </View>
    );
  }
  if (kind === "strategies") {
    const heights = [30, 52, 40, 72, 58, 96, 84, 120];
    return (
      <View style={styles.art}>
        <View style={styles.bars}>
          {heights.map((height, index) => (
            <View key={index} style={[styles.bar, { height, backgroundColor: index === heights.length - 1 ? tone.coral : ink }]} />
          ))}
        </View>
        <View style={styles.target} />
      </View>
    );
  }
  return (
    <View style={styles.art}>
      <View style={styles.ticket}>
        <Text style={styles.ticketTop}>LONG BTC · 3x</Text>
        <Text style={styles.ticketPnl}>+ $12.40</Text>
        <View style={styles.ticketRow}>
          <Text style={styles.ticketLabel}>STOP</Text>
          <Text style={styles.ticketLabel}>ENTRY</Text>
          <Text style={styles.ticketLabel}>TARGET</Text>
        </View>
      </View>
    </View>
  );
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = slides[index]!;
  const last = index === slides.length - 1;

  return (
    <View style={[styles.screen, { backgroundColor: slide.color, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.progress}>
        {slides.map((_, n) => (
          <Pressable key={n} onPress={() => setIndex(n)} hitSlop={8} style={[styles.segment, n === index && styles.segmentOn]} />
        ))}
      </View>
      <Text style={styles.title}>{slide.title}</Text>
      <Art kind={slide.art} />
      <Text style={styles.body}>
        {slide.lead} <Text style={styles.bold}>{slide.bold}</Text> {slide.tail}
      </Text>
      <View style={styles.footer}>
        <Pressable onPress={() => (last ? onDone() : setIndex(index + 1))} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>{last ? "Start trading" : "Next"}</Text>
        </Pressable>
        {!last && (
          <Pressable onPress={onDone} hitSlop={8}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...(StyleSheet.absoluteFill as object), zIndex: 90, elevation: 90, paddingHorizontal: space.lg, gap: space.lg },
  progress: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(20, 24, 26, 0.18)" },
  segmentOn: { backgroundColor: ink },
  title: { marginTop: space.lg, fontFamily: family.semibold, fontSize: 56, lineHeight: 58, letterSpacing: -2.4, color: ink },
  art: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg },
  weights: { flexDirection: "row", width: 240, height: 14, gap: 4 },
  weight: { borderRadius: 7 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 130 },
  bar: { width: 22, borderRadius: 8 },
  target: { width: 220, borderTopWidth: 2, borderStyle: "dashed", borderColor: ink },
  ticket: { width: 250, padding: space.lg, borderRadius: 24, backgroundColor: ink, gap: space.sm, transform: [{ rotate: "-4deg" }] },
  ticketTop: { fontFamily: family.semibold, fontSize: 14, letterSpacing: 1, color: "rgba(255,255,255,0.6)" },
  ticketPnl: { fontFamily: family.semibold, fontSize: 38, letterSpacing: -1.5, color: tone.lime },
  ticketRow: { flexDirection: "row", justifyContent: "space-between" },
  ticketLabel: { fontFamily: family.medium, fontSize: 11, letterSpacing: 1, color: "rgba(255,255,255,0.5)" },
  body: { fontFamily: family.regular, fontSize: 20, lineHeight: 28, color: ink },
  bold: { fontFamily: family.semibold },
  footer: { flexDirection: "row", alignItems: "center", gap: space.lg },
  button: { minHeight: 56, paddingHorizontal: 32, borderRadius: 28, backgroundColor: ink, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontFamily: family.semibold, fontSize: 16, color: "#ffffff" },
  skip: { fontFamily: family.regular, fontSize: 14, color: "rgba(20, 24, 26, 0.65)" },
  pressed: { opacity: 0.8 },
});
