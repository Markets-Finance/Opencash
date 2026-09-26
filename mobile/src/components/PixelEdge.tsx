import { StyleSheet, View } from "react-native";
import { color } from "../theme";

const steps = [
  { flex: 1, height: 28, opacity: 1 },
  { flex: 2, height: 56, opacity: 1 },
  { flex: 1, height: 28, opacity: 0.5 },
  { flex: 2, height: 40, opacity: 1 },
  { flex: 1, height: 20, opacity: 0.6 },
];

export function PixelEdge() {
  return (
    <View style={styles.row} pointerEvents="none">
      {steps.map((step, index) => (
        <View
          key={index}
          style={{
            flex: step.flex,
            height: step.height,
            opacity: step.opacity,
            backgroundColor: color.paper,
          }}
        />
      ))}
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tail: {
    flex: 3,
  },
});
