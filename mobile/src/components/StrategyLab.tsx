import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { defaultLimits, templates } from "shared";
import { addPaper, loadPapers, loadSeries } from "../lib/lab";
import { toolbox } from "../lib/bots";
import { dark, family, space, touch } from "../theme";
import { AssetMark } from "./AssetMark";
import { LineChart } from "./LineChart";
import { meta, money, pct, sample, tints } from "./labShared";

type Stage = "simulate" | "paper" | "live";

const frames = [
  { label: "1h", value: 3600 },
  { label: "4h", value: 14400 },
];

function Stepper({ spec, value, onChange }: { spec: templates.ParamSpec; value: number; onChange: (next: number) => void }) {
  if (spec.options) {
    return (
      <View style={styles.param}>
        <Text style={styles.paramLabel}>{spec.label}</Text>
        <View style={styles.segment}>
          {spec.options.map((option) => (
            <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segItem, styles.segFill, option.value === value && styles.segActive]}>
              <Text style={[styles.segLabel, option.value === value && styles.segLabelActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  const move = (direction: number) => onChange(Math.min(spec.max, Math.max(spec.min, Math.round((value + direction * spec.step) * 100) / 100)));
  return (
    <View style={styles.param}>
      <Text style={styles.paramLabel}>{spec.label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => move(-1)} style={styles.stepBtn} accessibilityLabel={`Decrease ${spec.label}`}>
          <Text style={styles.stepGlyph}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>
          {value}
          {spec.unit ? ` ${spec.unit}` : ""}
        </Text>
        <Pressable onPress={() => move(1)} style={styles.stepBtn} accessibilityLabel={`Increase ${spec.label}`}>
          <Text style={styles.stepGlyph}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function StrategyLab() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState("");
  const [resolution, setResolution] = useState(3600);
  const [series, setSeries] = useState<templates.Series | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<templates.TemplateId | null>(null);
  const [params, setParams] = useState<Record<string, templates.Params>>({});
  const [allocation, setAllocation] = useState(100);
  const [stage, setStage] = useState<Stage>("simulate");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void loadPapers();
    void toolbox.getMarkets().then((markets) => {
      const names = markets.map((m) => m.symbol);
      setSymbols(names);
      setSymbol(names.includes("BTC") ? "BTC" : (names[0] ?? ""));
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!symbol) return;
    setError(null);
    loadSeries(symbol, resolution).then(setSeries).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [symbol, resolution]);

  const paramsFor = useCallback((template: templates.Template) => params[template.id] ?? template.defaults, [params]);

  const run = (template: templates.Template) =>
    series ? templates.runTemplate(template, paramsFor(template), series, allocation) : null;

  const template = selected ? templates.templateById(selected) : null;
  const result = template ? run(template) : null;

  function startPaper() {
    if (!template || !series) return;
    addPaper(templates.paperFromBot(`${template.name} · ${series.market.symbol}`, template.id, series.market.symbol, series.resolution, { ...paramsFor(template) }, allocation, Date.now()));
    setNote("Paper bot started. It is below.");
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.label}>STRATEGIES</Text>
          <Text style={styles.title}>Pick one. See what it would have done.</Text>
        </View>
        <View style={styles.segment}>
          {frames.map((frame) => (
            <Pressable key={frame.value} onPress={() => setResolution(frame.value)} style={[styles.segItem, resolution === frame.value && styles.segActive]}>
              <Text style={[styles.segLabel, resolution === frame.value && styles.segLabelActive]}>{frame.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {symbols.map((name) => (
          <Pressable key={name} onPress={() => setSymbol(name)} style={[styles.chip, name === symbol && styles.chipActive]}>
            <AssetMark symbol={name} size={20} />
            <Text style={[styles.chipLabel, name === symbol && styles.chipLabelActive]}>{name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {error !== null && <Text style={styles.error}>{error}</Text>}
      {series === null && error === null && <Text style={styles.muted}>Loading history.</Text>}

      <View style={styles.grid}>
        {series !== null &&
          templates.library.map((entry) => {
            const m = run(entry)!.metrics;
            const info = meta[entry.id];
            return (
              <Pressable key={entry.id} onPress={() => { setSelected(entry.id); setNote(null); }} style={[styles.tile, selected === entry.id && styles.tileActive]}>
                <View style={styles.tileHead}>
                  <Text style={styles.tileName} numberOfLines={1}>{entry.name}</Text>
                  <View style={[styles.tag, { backgroundColor: tints[info.tint] }]}>
                    <Text style={styles.tagGlyph}>{info.glyph}</Text>
                  </View>
                </View>
                <Text style={[styles.tileBig, m.returnPct < 0 && styles.down]}>{pct(m.returnPct)}</Text>
                <Text style={styles.tileStats}>
                  Dip {m.maxDrawdownPct.toFixed(1)}% · Exits {m.closingFills}
                </Text>
                <Text style={styles.tileStats}>Just hold {pct(m.holdReturnPct)}</Text>
              </Pressable>
            );
          })}
      </View>

      {template && result && series && (
        <View style={styles.detail}>
          <Text style={styles.label}>
            {series.market.symbol} · 30 DAYS · TESTNET HISTORY
          </Text>
          <Text style={[styles.big, result.metrics.returnPct < 0 && styles.down]}>{pct(result.metrics.returnPct)}</Text>
          <Text style={styles.muted}>Just holding: {pct(result.metrics.holdReturnPct)}</Text>
          {result.equity.length > 2 && (
            <LineChart
              values={sample(result.equity.map((p) => p.equity))}
              height={140}
              color={result.metrics.returnPct >= 0 ? tints.lime : dark.red}
              label={(i) => `$${sample(result.equity.map((p) => p.equity))[i]!.toFixed(2)}`}
            />
          )}
          <View style={styles.metrics}>
            <View style={[styles.metric, { backgroundColor: tints.lime }]}>
              <Text style={[styles.metricLabel, { color: dark.limeInk }]}>Net</Text>
              <Text style={[styles.metricValue, { color: "#1b3a10" }]}>{money(result.metrics.netPnlUsd)}</Text>
            </View>
            <View style={[styles.metric, { backgroundColor: tints.purple }]}>
              <Text style={[styles.metricLabel, { color: "rgba(255,255,255,0.8)" }]}>Worst dip</Text>
              <Text style={[styles.metricValue, { color: "#fff" }]}>{result.metrics.maxDrawdownPct.toFixed(1)}%</Text>
            </View>
            <View style={[styles.metric, { backgroundColor: "#f3f4f1" }]}>
              <Text style={[styles.metricLabel, { color: "#5d6560" }]}>Winning exits</Text>
              <Text style={[styles.metricValue, { color: "#14181a" }]}>
                {result.metrics.winRatePct === null ? "—" : `${result.metrics.winRatePct.toFixed(0)}%`}
              </Text>
            </View>
            <View style={[styles.metric, { backgroundColor: dark.surfaceHover }]}>
              <Text style={styles.metricLabel}>Fees · funding</Text>
              <Text style={styles.metricValue}>
                {money(-result.metrics.feesUsd)} · {money(result.metrics.fundingUsd)}
              </Text>
            </View>
          </View>
          <Text style={styles.muted}>
            Includes Perpl fees, {templates.defaultSimOptions.slippageBps} bps slippage and funding.
            {result.metrics.liquidated ? " This setting would have been liquidated." : ""}
          </Text>

          <Text style={styles.name}>{template.name}</Text>
          <Text style={styles.muted}>{template.blurb}</Text>
          {template.params.map((spec) => (
            <Stepper
              key={spec.key}
              spec={spec}
              value={paramsFor(template)[spec.key] ?? spec.min}
              onChange={(next) => setParams((prev) => ({ ...prev, [template.id]: { ...paramsFor(template), [spec.key]: next } }))}
            />
          ))}

          <View style={styles.segment}>
            {(["simulate", "paper", "live"] as Stage[]).map((key) => (
              <Pressable key={key} onPress={() => setStage(key)} style={[styles.segItem, styles.segFill, stage === key && styles.segActive]}>
                <Text style={[styles.segLabel, stage === key && styles.segLabelActive]}>{key[0]!.toUpperCase() + key.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <Stepper
            spec={{ key: "allocation", label: "Allocation cap", min: 10, max: defaultLimits.maxMarginUsd, step: 10, unit: "USD" }}
            value={allocation}
            onChange={setAllocation}
          />
          {stage === "simulate" && <Text style={styles.muted}>Replay only. Nothing is placed.</Text>}
          {stage === "paper" && (
            <>
              <Text style={styles.muted}>Live prices, simulated fills. It acts when each candle closes, so the first move comes after the next one.</Text>
              <Pressable onPress={startPaper} style={styles.primary}>
                <Text style={styles.primaryLabel}>Start paper bot</Text>
              </Pressable>
            </>
          )}
          {stage === "live" && (
            <Text style={styles.muted}>
              Real orders under the cap. Unlocks after a 24 hour paper run. Order placement for these strategies ships after the first real testnet order is verified.
            </Text>
          )}
          {note !== null && <Text style={styles.muted}>{note}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md },
  headText: { flex: 1, gap: space.xs },
  label: { fontFamily: family.medium, fontSize: 11, letterSpacing: 1.3, color: dark.muted },
  title: { fontFamily: family.medium, fontSize: 22, letterSpacing: -0.6, color: dark.ink },
  chips: { gap: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.md, minHeight: touch, borderRadius: 999, backgroundColor: dark.surfaceHover },
  chipActive: { backgroundColor: dark.ink },
  chipLabel: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
  chipLabelActive: { color: dark.paper },
  muted: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  error: { fontFamily: family.regular, fontSize: 12, color: dark.red },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  tile: { width: "47.5%", flexGrow: 1, padding: space.md, borderRadius: 28, borderWidth: 1, borderColor: dark.surfaceLine, backgroundColor: dark.surface, gap: space.sm },
  tileActive: { borderColor: dark.ink },
  tileHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.xs },
  tileName: { flex: 1, fontFamily: family.regular, fontSize: 13, color: dark.ink },
  tag: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  tagGlyph: { fontFamily: family.semibold, fontSize: 16, color: "#14181a" },
  tileBig: { fontFamily: family.medium, fontSize: 38, letterSpacing: -1.8, color: dark.ink },
  tileStats: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  down: { color: dark.red },
  detail: { padding: space.lg, borderRadius: 28, backgroundColor: dark.surface, gap: space.md },
  big: { fontFamily: family.medium, fontSize: 64, letterSpacing: -3, color: dark.ink },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  metric: { width: "48.5%", flexGrow: 1, padding: space.md, borderRadius: 18, gap: space.xs, minHeight: 72, justifyContent: "space-between" },
  metricLabel: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  metricValue: { fontFamily: family.medium, fontSize: 17, color: dark.ink },
  name: { fontFamily: family.semibold, fontSize: 15, color: dark.ink },
  param: { gap: space.xs },
  paramLabel: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 999, backgroundColor: dark.surfaceHover },
  stepBtn: { width: touch + space.sm, height: touch + space.sm, alignItems: "center", justifyContent: "center" },
  stepGlyph: { fontFamily: family.medium, fontSize: 22, color: dark.ink },
  stepValue: { fontFamily: family.medium, fontSize: 15, color: dark.ink },
  segment: { flexDirection: "row", borderRadius: 999, backgroundColor: dark.surfaceHover, padding: 3 },
  segItem: { minHeight: touch, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  segFill: { flex: 1 },
  segActive: { backgroundColor: dark.ink },
  segLabel: { fontFamily: family.medium, fontSize: 13, color: dark.muted },
  segLabelActive: { color: dark.paper },
  primary: { minHeight: touch + space.md, borderRadius: 999, backgroundColor: dark.accent, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.onAccent },
});
