import { StyleSheet, Text, View } from "react-native";
import { Diamond } from "./Diamond";
import { color, family, radius, space, track } from "../theme";

type NavPillProps = {
  wordmark: string;
  accent: string;
  action: string;
};

export function NavPill({ wordmark, accent, action }: NavPillProps) {
  return (
    <View style={styles.pill}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>
          {wordmark}
          <Text style={styles.accent}>{accent}</Text>
        </Text>
        <Diamond size={8} fill={color.paper} />
      </View>
      <Text style={styles.action}>{action}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.xxl,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    backgroundColor: color.nav,
    borderRadius: radius,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  wordmark: {
    fontFamily: family.semibold,
    fontSize: 20,
    letterSpacing: track(20, -0.04),
    color: color.paper,
  },
  accent: {
    color: color.purpleLift,
  },
  action: {
    fontFamily: family.regular,
    fontSize: 13,
    color: color.onDarkMuted,
  },
});
