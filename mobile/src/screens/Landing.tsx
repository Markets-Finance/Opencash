import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mark } from "../components/Mark";
import { dark, family, space, track } from "../theme";

export function Landing({ onSignIn }: { onSignIn: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + space.xxl,
          paddingBottom: insets.bottom + space.xl,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.mark}>
          <Mark size={40} tint={dark.onAccent} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>OPENCASH</Text>
          <Text style={styles.title}>Trade the narrative.{"\n"}With leverage.</Text>
          <Text style={styles.subtitle}>
            A bin groups Hyperliquid markets that move together into one
            position. Set the size and leverage; your passkey signs every order.
          </Text>
        </View>

        <View style={styles.facts}>
          {[
            ["Composition", "Markets that move together"],
            ["Leverage", "Capped by your deposit"],
            ["Custody", "OpenCash never holds withdrawal power"],
          ].map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        onPress={onSignIn}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>Get started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: dark.paper,
    paddingHorizontal: space.xl,
  },
  content: { flex: 1, justifyContent: "center", gap: space.xl },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: space.md },
  eyebrow: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.14),
    color: dark.muted,
  },
  title: {
    fontFamily: family.display,
    fontSize: 38,
    lineHeight: 38 * 1.14,
    color: dark.ink,
  },
  subtitle: {
    fontFamily: family.regular,
    fontSize: 15,
    lineHeight: 15 * 1.6,
    color: dark.muted,
    maxWidth: 320,
  },
  facts: { gap: space.md, padding: space.lg, borderRadius: 18, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.surfaceLine },
  fact: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  factLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: dark.muted,
    width: 96,
  },
  factValue: {
    flex: 1,
    fontFamily: family.regular,
    fontSize: 13,
    lineHeight: 13 * 1.55,
    color: dark.ink,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
    borderRadius: 33,
    backgroundColor: dark.accent,
  },
  buttonLabel: { fontFamily: family.medium, fontSize: 16, color: dark.onAccent },
  pressed: { opacity: 0.85 },
});
