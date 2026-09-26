import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DashedRule } from "../components/DashedRule";
import { Mark } from "../components/Mark";
import { SectionLabel } from "../components/SectionLabel";
import { color, family, radius, space, track } from "../theme";

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
        <Mark size={72} />

        <View style={styles.copy}>
          <SectionLabel>OPENCASH</SectionLabel>
          <Text style={styles.title}>Take a framing{"\n"}in one tap.</Text>
          <Text style={styles.subtitle}>
            A bin pools a whole theme into one position. Every leg prices on its
            own market, and your passkey signs every call.
          </Text>
        </View>

        <DashedRule />

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
    backgroundColor: color.paper,
    paddingHorizontal: space.xl,
  },
  content: { flex: 1, justifyContent: "center", gap: space.xl },
  copy: { gap: space.md },
  title: {
    fontFamily: family.light,
    fontSize: 40,
    lineHeight: 40 * 1.14,
    letterSpacing: track(40, -0.04),
    color: color.ink,
  },
  subtitle: {
    fontFamily: family.light,
    fontSize: 15,
    lineHeight: 15 * 1.6,
    color: "#6f6d6a",
    maxWidth: 320,
  },
  facts: { gap: space.md },
  fact: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  factLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#8a8884",
    width: 96,
  },
  factValue: {
    flex: 1,
    fontFamily: family.light,
    fontSize: 13,
    lineHeight: 13 * 1.55,
    color: color.ink,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: radius,
    backgroundColor: color.purple,
  },
  buttonLabel: {
    fontFamily: family.medium,
    fontSize: 16,
    color: color.paper,
  },
  pressed: { opacity: 0.9 },
});
