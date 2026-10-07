import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { dark, family, space } from "../theme";

type LineChartProps = {
  values: number[];
  height: number;
  color: string;
  label: (index: number) => string;
};

const tipWidth = 168;

export function LineChart({ values, height, color, label }: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const min = Math.min(...values);
  const spread = Math.max(...values) - min || 1;
  const xs = values.map((_, i) => (i / (values.length - 1)) * width);
  const ys = values.map((v) => space.sm + (1 - (v - min) / spread) * (height - space.sm * 2));

  function scrub(x: number) {
    if (width === 0) return;
    setActive(Math.round(Math.min(1, Math.max(0, x / width)) * (values.length - 1)));
  }

  return (
    <View
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => scrub(event.nativeEvent.locationX)}
      onResponderMove={(event) => scrub(event.nativeEvent.locationX)}
      onResponderRelease={() => setActive(null)}
    >
      {width > 0 &&
        xs.slice(1).map((x, i) => {
          const dx = x - xs[i];
          const dy = ys[i + 1] - ys[i];
          const length = Math.hypot(dx, dy);
          return (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.segment,
                {
                  backgroundColor: color,
                  width: length,
                  left: (xs[i] + x) / 2 - length / 2,
                  top: (ys[i] + ys[i + 1]) / 2 - 1,
                  transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                },
              ]}
            />
          );
        })}
      {active !== null && width > 0 && (
        <>
          <View pointerEvents="none" style={[styles.cross, { left: xs[active] }]} />
          <View
            pointerEvents="none"
            style={[styles.dot, { left: xs[active] - 6, top: ys[active] - 6, borderColor: color }]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.tip,
              { left: Math.min(width - tipWidth, Math.max(0, xs[active] - tipWidth / 2)) },
            ]}
          >
            <Text style={styles.tipText}>{label(active)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { position: "absolute", height: 2, borderRadius: 1 },
  cross: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: dark.line },
  dot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: dark.paper,
  },
  tip: {
    position: "absolute",
    top: 0,
    width: tipWidth,
    paddingVertical: space.xs,
    borderRadius: space.sm,
    borderWidth: 1,
    borderColor: dark.line,
    backgroundColor: dark.surfaceHover,
  },
  tipText: { fontFamily: family.medium, fontSize: 11, color: dark.ink, textAlign: "center" },
});
