import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { templates } from "shared";
import { loadSeries, removePaper, subscribePapers } from "../lib/lab";
import { dark, family, space, touch } from "../theme";
import { AssetMark } from "./AssetMark";
import { LineChart } from "./LineChart";
import { meta, money, pct, sample, tints } from "./labShared";

type Row = { bot: templates.PaperBot; result: templates.SimResult | null; error: string | null };

export function PaperBots() {
  const [bots, setBots] = useState<templates.PaperBot[]>([]);
  const [views, setViews] = useState<Row[]>([]);

  useEffect(() => subscribePapers(setBots), []);

  useEffect(() => {
    let live = true;
    async function run() {
      const next = await Promise.all(
        bots.map(async (bot): Promise<Row> => {
          try {
            const series = await loadSeries(bot.symbol, bot.resolution);
            return { bot, result: templates.runPaper(bot, series.candles, templates.simOptions(series, bot.allocationUsd)), error: null };
          } catch (error) {
            return { bot, result: null, error: error instanceof Error ? error.message : String(error) };
          }
        }),
      );
      if (live) setViews(next);
    }
    void run();
    const timer = setInterval(() => void run(), 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [bots]);

  if (views.length === 0) return null;

  return (
    <>
      {views.map(({ bot, result, error }) => {
        const m = result?.metrics;
        const up = (m?.returnPct ?? 0) >= 0;
        return (
          <View key={bot.id} style={styles.card}>
            <View style={styles.row}>
              <AssetMark symbol={bot.symbol} size={28} />
              <Text style={styles.name}>{bot.name}</Text>
              <Text style={styles.pill}>Paper</Text>
              <Text style={styles.cap}>Cap ${bot.allocationUsd}</Text>
            </View>
            {error !== null && <Text style={styles.muted}>{error}</Text>}
            {error === null && (!result || result.candles === 0) && (
              <Text style={styles.muted}>Waiting for the next candle. It acts when that candle closes.</Text>
            )}
            {m && result && result.candles > 0 && (
              <>
                <Text style={[styles.big, !up && styles.down]}>{pct(m.returnPct, 2)}</Text>
                {result.equity.length > 2 && (
                  <LineChart
                    values={sample(result.equity.map((p) => p.equity))}
                    height={90}
                    color={up ? tints.lime : dark.red}
                    label={(i) => `$${sample(result.equity.map((p) => p.equity))[i]!.toFixed(2)}`}
                  />
                )}
                <View style={styles.stats}>
                  <Text style={styles.stat}>Net {money(m.netPnlUsd)}</Text>
                  <Text style={styles.stat}>Exits {m.closingFills}</Text>
                  <Text style={styles.stat}>Dip {m.maxDrawdownPct.toFixed(1)}%</Text>
                </View>
              </>
            )}
            <Pressable onPress={() => removePaper(bot.id)} style={styles.delete}>
              <Text style={styles.deleteLabel}>Delete</Text>
            </Pressable>
            <View style={[styles.stripe, { backgroundColor: tints[meta[bot.templateId].tint] }]} />
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: 28, backgroundColor: dark.surface, gap: space.md, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  name: { fontFamily: family.semibold, fontSize: 14, color: dark.ink },
  pill: { fontFamily: family.medium, fontSize: 11, color: dark.muted, backgroundColor: dark.surfaceHover, paddingVertical: 3, paddingHorizontal: space.sm, borderRadius: 999, overflow: "hidden" },
  cap: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  big: { fontFamily: family.medium, fontSize: 48, letterSpacing: -2, color: dark.ink },
  down: { color: dark.red },
  muted: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  stats: { flexDirection: "row", gap: space.md, flexWrap: "wrap" },
  stat: { fontFamily: family.medium, fontSize: 12, color: dark.muted },
  delete: { minHeight: touch, justifyContent: "center", alignSelf: "flex-start" },
  deleteLabel: { fontFamily: family.medium, fontSize: 13, color: dark.muted },
  stripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
});
