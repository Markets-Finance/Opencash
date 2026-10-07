import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";
import { dark } from "../theme";

const box = { width: 622, height: 618 };
const stroke = 46;

type Segment = { from: [number, number]; to: [number, number]; row: number };

const segments: Segment[] = [
  { from: [219, 23], to: [403, 23], row: 0 },
  { from: [111, 103], to: [511, 103], row: 1 },
  { from: [48, 183], to: [272, 183], row: 2 },
  { from: [350, 183], to: [574, 183], row: 2 },
  { from: [369, 183], to: [451, 263], row: 3 },
  { from: [23, 263], to: [191, 263], row: 3 },
  { from: [431, 263], to: [599, 263], row: 3 },
  { from: [23, 355], to: [191, 355], row: 4 },
  { from: [431, 355], to: [599, 355], row: 4 },
  { from: [451, 355], to: [369, 435], row: 5 },
  { from: [48, 435], to: [272, 435], row: 5 },
  { from: [350, 435], to: [574, 435], row: 5 },
  { from: [111, 515], to: [511, 515], row: 6 },
  { from: [219, 595], to: [403, 595], row: 7 },
];

const drawMs = 320;
const staggerMs = 70;
const holdMs = 260;
const exitMs = 320;

export function MarkIntro({ size = 120, onDone }: { size?: number; onDone: () => void }) {
  const draws = useRef(segments.map(() => new Animated.Value(0))).current;
  const exit = useRef(new Animated.Value(0)).current;
  const unit = size / box.width;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        onDone();
        return;
      }
      Animated.sequence([
        Animated.parallel(
          draws.map((value, index) =>
            Animated.timing(value, {
              toValue: 1,
              duration: drawMs,
              delay: segments[index].row * staggerMs,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ),
        ),
        Animated.delay(holdMs),
        Animated.timing(exit, {
          toValue: 1,
          duration: exitMs,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) onDone();
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.screen,
        { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
      ]}
    >
      <Animated.View
        style={{
          width: size,
          height: box.height * unit,
          transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
        }}
      >
        {segments.map((segment, index) => {
          const dx = segment.to[0] - segment.from[0];
          const dy = segment.to[1] - segment.from[1];
          const cap = (stroke / 2) * unit;
          return (
            <Animated.View
              key={index}
              style={[
                styles.bar,
                {
                  left: segment.from[0] * unit - cap,
                  top: segment.from[1] * unit - cap,
                  width: Math.hypot(dx, dy) * unit + cap * 2,
                  height: cap * 2,
                  borderRadius: cap,
                  transformOrigin: [cap, cap, 0],
                  transform: [
                    { rotate: `${Math.atan2(dy, dx)}rad` },
                    { scaleX: draws[index].interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) },
                  ],
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: dark.paper, alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", backgroundColor: dark.ink },
});
