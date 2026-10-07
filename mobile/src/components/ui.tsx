import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { dark, family, space, touch } from "../theme";

export const tone = {
  violet: "#7b73f0",
  coral: "#ec6f5c",
  butter: "#f2d16b",
  lime: "#b4f58c",
  sky: "#cfe6ff",
  peach: "#f2b98b",
  paper: "#f3f4f1",
  ink: "#14181a",
  card: "#1d2321",
} as const;

export type Tone = keyof typeof tone;

export function ScreenTitle({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      {onBack && <RoundButton glyph="←" onPress={onBack} label="Back" light />}
      <Text style={styles.title} numberOfLines={2}>
        {title.toUpperCase()}
      </Text>
      {right}
    </View>
  );
}

export function RoundButton({
  glyph,
  onPress,
  label,
  light,
  fill,
}: {
  glyph: string;
  onPress?: () => void;
  label: string;
  light?: boolean;
  fill?: string;
}) {
  const background = fill ?? (light ? tone.paper : tone.card);
  const ink = fill || light ? tone.ink : dark.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { backgroundColor: background }, pressed && styles.pressed]}
    >
      <Text style={[styles.roundGlyph, { color: ink }]}>{glyph}</Text>
    </Pressable>
  );
}

export function ArrowBadge({ onPress, label = "Open", dark: onDark }: { onPress?: () => void; label?: string; dark?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.arrow, onDark && styles.arrowDark, pressed && styles.pressed]}
    >
      <Text style={[styles.arrowGlyph, onDark && styles.arrowGlyphDark]}>↗</Text>
    </Pressable>
  );
}

export function SelectPill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && styles.pressed]}
    >
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, dot, onColor }: { label: string; dot?: string; onColor?: boolean }) {
  return (
    <View style={[styles.tag, onColor && styles.tagOnColor]}>
      {dot && <View style={[styles.tagDot, { backgroundColor: dot }]} />}
      <Text style={[styles.tagLabel, onColor && styles.tagLabelOnColor]}>{label}</Text>
    </View>
  );
}

export function ToneCard({ fill, children, style }: { fill?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, { backgroundColor: fill ?? tone.card }, style]}>{children}</View>;
}

export function CardTitle({ children, onColor }: { children: string; onColor?: boolean }) {
  return <Text style={[styles.cardTitle, onColor && styles.onColor]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52 },
  title: { flexShrink: 1, fontFamily: family.semibold, fontSize: 30, lineHeight: 32, letterSpacing: -1.2, color: dark.ink },
  round: { width: touch + space.xs, height: touch + space.xs, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  roundGlyph: { fontFamily: family.medium, fontSize: 20 },
  pressed: { opacity: 0.75 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: tone.paper, alignItems: "center", justifyContent: "center" },
  arrowDark: { backgroundColor: tone.ink },
  arrowGlyph: { fontFamily: family.semibold, fontSize: 17, color: tone.ink },
  arrowGlyphDark: { color: tone.paper },
  pill: { minHeight: touch, paddingHorizontal: space.lg, borderRadius: 999, backgroundColor: tone.card, alignItems: "center", justifyContent: "center" },
  pillActive: { backgroundColor: tone.paper },
  pillLabel: { fontFamily: family.medium, fontSize: 13, color: dark.muted },
  pillLabelActive: { color: tone.ink },
  tag: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingVertical: 4, paddingHorizontal: space.sm, borderRadius: 999, backgroundColor: dark.surfaceHover },
  tagOnColor: { backgroundColor: "rgba(20, 24, 26, 0.12)" },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagLabel: { fontFamily: family.medium, fontSize: 11, letterSpacing: 0.3, color: dark.ink },
  tagLabelOnColor: { color: tone.ink },
  card: { borderRadius: 28, padding: space.lg, gap: space.md },
  cardTitle: { fontFamily: family.semibold, fontSize: 22, lineHeight: 24, letterSpacing: -0.8, color: dark.ink },
  onColor: { color: tone.ink },
});
