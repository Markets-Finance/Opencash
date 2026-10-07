import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mark } from "../components/Mark";
import { dark, family, space } from "../theme";

export function Landing({ onSignIn }: { onSignIn: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.mark}>
          <Mark size={72} tint={dark.onAccent} />
        </View>
        <Text style={styles.name}>OpenCash</Text>
        <Text style={styles.tagline}>Trade the story.</Text>
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
  screen: { flex: 1, backgroundColor: dark.paper, paddingHorizontal: space.xl },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg },
  mark: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: family.display, fontSize: 44, color: dark.ink },
  tagline: { fontFamily: family.regular, fontSize: 18, color: dark.muted },
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
