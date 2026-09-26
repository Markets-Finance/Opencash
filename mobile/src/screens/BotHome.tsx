import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TradingAccount } from "shared";
import { DashedRule } from "../components/DashedRule";
import { Mark } from "../components/Mark";
import { SectionLabel } from "../components/SectionLabel";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { color, family, radius, space, track } from "../theme";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type BotHomeProps = {
  trader: TradingAccount;
  onAuthorize: () => void;
  onSelectTab: (key: TabKey) => void;
};

export function BotHome({ trader, onAuthorize, onSelectTab }: BotHomeProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.xl,
            paddingBottom: tabBarHeight + insets.bottom + space.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel>BOT</SectionLabel>
        <Text style={styles.title}>Let an agent place the legs.</Text>
        <Text style={styles.lede}>
          A bot trades on your behalf inside a scope you set. It can never
          withdraw, and it stops at expiry or the moment you revoke it.
        </Text>

        <DashedRule />

        <View style={styles.card}>
          <Mark size={56} tint={color.node} />
          <Text style={styles.cardTitle}>No bot authorized</Text>
          <Text style={styles.cardBody}>
            Your passkey owns {shortAddress(trader.address)}. Authorizing grants
            a scoped session key — approve USDG and batch swaps, nothing else.
          </Text>
          <Pressable
            onPress={onAuthorize}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaLabel}>Authorize a bot</Text>
          </Pressable>
        </View>

        <View style={styles.scope}>
          <Text style={styles.scopeLabel}>WHAT A BOT CAN DO</Text>
          {[
            "Approve USDG spending",
            "Batch-swap USDG into bin legs",
          ].map((item) => (
            <Text key={item} style={styles.scopeItem}>
              {item}
            </Text>
          ))}
          <Text style={styles.scopeDenied}>Never: withdraw or transfer out</Text>
        </View>
      </ScrollView>

      <TabBar active="home" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { paddingHorizontal: space.xl, gap: space.lg },
  title: {
    fontFamily: family.light,
    fontSize: 30,
    lineHeight: 30 * 1.18,
    letterSpacing: track(30, -0.04),
    color: color.ink,
  },
  lede: {
    fontFamily: family.light,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: "#6f6d6a",
  },
  card: {
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: "#fdfcfa",
    padding: space.xl,
    alignItems: "center",
    gap: space.md,
  },
  cardTitle: {
    fontFamily: family.medium,
    fontSize: 17,
    letterSpacing: track(17, -0.03),
    color: color.ink,
  },
  cardBody: {
    fontFamily: family.light,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#6f6d6a",
    textAlign: "center",
  },
  cta: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: radius,
    backgroundColor: color.purple,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
  ctaLabel: { fontFamily: family.medium, fontSize: 15, color: color.paper },
  pressed: { opacity: 0.9 },
  scope: { gap: space.sm },
  scopeLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#8a8884",
  },
  scopeItem: {
    fontFamily: family.light,
    fontSize: 13,
    color: color.ink,
  },
  scopeDenied: {
    fontFamily: family.light,
    fontSize: 13,
    color: "#a5382a",
  },
});
