import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { dotmatrix } from "shared";
import { currentLoader, subscribeLoader, type LoaderState } from "../lib/dotLoader";
import { dark, family } from "../theme";

export function DotLoader() {
  const [loader, setLoader] = useState<LoaderState | null>(currentLoader());
  const [dots, setDots] = useState<dotmatrix.Dot[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => subscribeLoader(() => setLoader(currentLoader())), []);

  useEffect(() => {
    if (loader === null) {
      fade.setValue(1);
      setDots([]);
      return;
    }
    let frame = 0;
    const tick = () => {
      setDots(loader.engine.frame(Date.now()));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loader?.engine]);

  useEffect(() => {
    if (loader?.fading) Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start();
  }, [loader?.fading]);

  if (loader === null) return null;
  const radius = loader.engine.pitch * 0.38;

  return (
    <Animated.View pointerEvents="auto" style={[styles.overlay, { opacity: fade }]}>
      <Text style={styles.label}>SIGNING…</Text>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {dots.map((dot, index) => (
          <View key={index} style={[styles.dot, { left: dot.x - radius, top: dot.y - radius, width: radius * 2, height: radius * 2, borderRadius: radius }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...(StyleSheet.absoluteFill as object), zIndex: 100, elevation: 100, backgroundColor: dark.paper },
  label: { position: "absolute", left: 24, top: 56, fontFamily: family.semibold, fontSize: 11, letterSpacing: 1.3, color: "#7165ed" },
  dot: { position: "absolute", backgroundColor: dark.ink },
});
