import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { perpl } from "shared";
import { toolbox } from "../lib/bots";
import { dark, family, space } from "../theme";

const barCount = 28;

function compact(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function VolumeBars() {
  const [bars, setBars] = useState<number[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let live = true;
    perpl
      .exchangeVolumeSeries(toolbox, 7)
      .then((series) => {
        if (!live) return;
        const size = Math.max(1, Math.ceil(series.length / barCount));
        const grouped: number[] = [];
        for (let i = 0; i < series.length; i += size) grouped.push(series.slice(i, i + size).reduce((sum, point) => sum + point.value, 0));
        setTotal(series.reduce((sum, point) => sum + point.value, 0));
        setBars(grouped);
      })
      .catch(() => live && setBars([]));
    return () => {
      live = false;
    };
  }, []);

  const peak = Math.max(1, ...(bars ?? []));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>PERPL VOLUME · 7D</Text>
        {bars !== null && bars.length > 0 && <Text style={styles.total}>{compact(total)} AUSD</Text>}
      </View>
      {bars === null ? (
        <ActivityIndicator color={dark.ink} />
      ) : bars.length === 0 ? (
        <Text style={styles.muted}>Perpl volume is unavailable right now.</Text>
      ) : (
        <View style={styles.chart}>
          {bars.map((value, index) => (
            <View key={index} style={[styles.bar, { height: `${Math.max(4, (value / peak) * 100)}%` }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: 24, backgroundColor: dark.surface, gap: space.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: family.semibold, fontSize: 12, letterSpacing: 1, color: dark.muted },
  total: { fontFamily: family.semibold, fontSize: 14, color: dark.ink },
  chart: { height: 120, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { flex: 1, borderRadius: 3, backgroundColor: "#7165ed" },
  muted: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
});
