import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DashedRule } from "../components/DashedRule";
import { NavPill } from "../components/NavPill";
import { PixelEdge } from "../components/PixelEdge";
import { SectionLabel } from "../components/SectionLabel";
import { StageCard } from "../components/StageCard";
import { color, family, space, track } from "../theme";

const stages = [
  {
    name: "Collateral",
    description:
      "Post a live lending position as margin. Yield keeps accruing while it backs your trades.",
    active: true,
  },
  {
    name: "Routing",
    description:
      "Orders route across Monad's open liquidity through a single on-chain call.",
  },
  {
    name: "Execution",
    description:
      "Fills settle at chain speed. No pending states, no custodial hop.",
  },
  {
    name: "Settlement",
    description:
      "Positions close back into the same account that funded them.",
  },
];

export function Landing() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.block }}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          source={require("../../assets/images/city.webp")}
          style={[styles.hero, { paddingTop: insets.top }]}
          imageStyle={styles.heroImage}
        >
          <View style={styles.scrim} />
          <PixelEdge />
          <View style={styles.heroBody}>
            <Text style={styles.heroHeading}>
              Margin that never stops working.
            </Text>
            <Text style={styles.heroSub}>
              A trading terminal where your collateral is a live position, not
              idle cash.
            </Text>
          </View>
          <View style={styles.caption}>
            <View style={styles.statusDot} />
            <Text style={styles.captionText}>MONAD MAINNET</Text>
            <Text style={styles.captionDivider}>/</Text>
            <Text style={styles.captionText}>CHAIN 143</Text>
          </View>
        </ImageBackground>

        <View style={styles.sheet}>
          <SectionLabel>THE LIFECYCLE</SectionLabel>
          <Text style={styles.sheetHeading}>
            From deposit to fill, in one account.
          </Text>
          <View style={styles.stages}>
            {stages.map((stage) => (
              <View key={stage.name}>
                <DashedRule />
                <StageCard
                  name={stage.name}
                  description={stage.description}
                  active={stage.active}
                />
              </View>
            ))}
            <DashedRule />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.header, { top: insets.top + space.md }]}>
        <NavPill wordmark="meu" accent="terminal" action="Explore" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.paper,
  },
  hero: {
    minHeight: 560,
    backgroundColor: color.dark,
    justifyContent: "flex-end",
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
  },
  heroImage: {
    resizeMode: "cover",
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20, 20, 27, 0.55)",
  },
  heroBody: {
    marginBottom: space.xxl,
  },
  heroHeading: {
    fontFamily: family.light,
    fontSize: 42,
    lineHeight: 42 * 1.06,
    letterSpacing: track(42, -0.04),
    color: color.paper,
    textAlign: "center",
  },
  heroSub: {
    fontFamily: family.regular,
    fontSize: 15,
    lineHeight: 15 * 1.6,
    color: color.onDark,
    textAlign: "center",
    marginTop: space.lg,
  },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.purpleLift,
  },
  captionText: {
    fontFamily: family.regular,
    fontSize: 10,
    letterSpacing: track(10, 0.08),
    color: color.onDarkMuted,
  },
  captionDivider: {
    fontFamily: family.regular,
    fontSize: 10,
    color: color.onDarkMuted,
    opacity: 0.5,
  },
  sheet: {
    paddingHorizontal: space.xl,
    paddingTop: space.section,
  },
  sheetHeading: {
    fontFamily: family.light,
    fontSize: 32,
    lineHeight: 32 * 1.12,
    letterSpacing: track(32, -0.04),
    color: color.ink,
    marginTop: space.xl,
  },
  stages: {
    marginTop: space.section,
  },
  header: {
    position: "absolute",
    left: space.xl,
    right: space.xl,
  },
});
