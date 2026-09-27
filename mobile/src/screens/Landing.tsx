import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mark } from "../components/Mark";
import { family, space, track } from "../theme";

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
          <Mark size={40} tint="#fff" />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>OPENCASH</Text>
          <Text style={styles.title}>Take a framing{"\n"}in one tap.</Text>
          <Text style={styles.subtitle}>
            A bin pools a whole theme into one position. Every leg prices on its
            own market, and your passkey signs every call.
          </Text>
        </View>

        <View style={styles.facts}>
          {[
            ["Composition", "Pooled around one theme"],
            ["Pricing", "Each leg on its own venue"],
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
    backgroundColor: "#ededed",
    paddingHorizontal: space.xl,
  },
  content: { flex: 1, justifyContent: "center", gap: space.xl },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#090909",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: space.md },
  eyebrow: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.14),
    color: "#858589",
  },
  title: {
    fontFamily: family.semibold,
    fontSize: 38,
    lineHeight: 38 * 1.14,
    letterSpacing: track(38, -0.04),
    color: "#0c0c0c",
  },
  subtitle: {
    fontFamily: family.regular,
    fontSize: 15,
    lineHeight: 15 * 1.6,
    color: "#77777a",
    maxWidth: 320,
  },
  facts: { gap: space.md, padding: space.lg, borderRadius: 18, backgroundColor: "#fafafa" },
  fact: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  factLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
    width: 96,
  },
  factValue: {
    flex: 1,
    fontFamily: family.regular,
    fontSize: 13,
    lineHeight: 13 * 1.55,
    color: "#131315",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
    borderRadius: 33,
    backgroundColor: "#050505",
  },
  buttonLabel: { fontFamily: family.medium, fontSize: 16, color: "#fff" },
  pressed: { opacity: 0.85 },
});
