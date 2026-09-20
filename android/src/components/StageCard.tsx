import { StyleSheet, Text, View } from "react-native";
import { Diamond } from "./Diamond";
import { color, family, space, track } from "../theme";

type StageCardProps = {
  name: string;
  description: string;
  active?: boolean;
};

export function StageCard({ name, description, active = false }: StageCardProps) {
  return (
    <View style={styles.row}>
      <View style={styles.anchor}>
        <Diamond size={6} fill={active ? color.purple : color.node} />
      </View>
      <View style={[styles.card, active && styles.cardActive]}>
        <Text style={[styles.name, active && styles.nameActive]}>{name}</Text>
        <Text style={[styles.description, active && styles.descriptionActive]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.lg,
  },
  anchor: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.lg,
  },
  card: {
    flex: 1,
    paddingVertical: space.lg,
    paddingRight: space.sm,
  },
  cardActive: {
    paddingLeft: space.lg,
    backgroundColor: color.purpleFill,
  },
  name: {
    fontFamily: family.regular,
    fontSize: 16,
    letterSpacing: track(16, -0.02),
    color: color.ink,
  },
  nameActive: {
    color: color.paper,
  },
  description: {
    fontFamily: family.light,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#6f6d6a",
    marginTop: space.sm,
  },
  descriptionActive: {
    color: color.onDarkFaint,
  },
});
