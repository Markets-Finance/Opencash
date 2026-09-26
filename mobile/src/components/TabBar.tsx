import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Diamond } from "./Diamond";
import { color, family, space, track } from "../theme";

export type TabKey = "home" | "bins" | "trade" | "account";

const tabs: { key: TabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "bins", label: "Bins" },
  { key: "trade", label: "Trade" },
  { key: "account", label: "Account" },
];

type TabBarProps = {
  active: TabKey;
  onSelect: (key: TabKey) => void;
};

export function TabBar({ active, onSelect }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <Diamond size={5} fill={selected ? color.purple : color.node} />
            <Text style={[styles.label, selected && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const tabBarHeight = 72;

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    paddingTop: space.md,
    backgroundColor: color.paper,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  tab: { flex: 1, alignItems: "center", gap: space.xs },
  pressed: { opacity: 0.6 },
  label: {
    fontFamily: family.regular,
    fontSize: 11,
    letterSpacing: track(11, 0.06),
    color: "#8a8884",
  },
  labelActive: { fontFamily: family.medium, color: color.purpleLabel },
});
