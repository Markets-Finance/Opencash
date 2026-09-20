import { StyleSheet, Text, View } from "react-native";
import { Diamond } from "./Diamond";
import { color, family, space, track } from "../theme";

export function SectionLabel({ children }: { children: string }) {
  return (
    <View style={styles.row}>
      <Diamond />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  text: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: color.purpleLabel,
  },
});
