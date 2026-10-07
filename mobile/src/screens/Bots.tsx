import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bot, BotMode } from "shared";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { draftBot, removeBot, setBotEnabled, subscribeBots, updateBotRules } from "../lib/bots";
import { dark, family, space, touch, track } from "../theme";

const explorer = "https://testnet.monadexplorer.com/tx/";

function usd(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function legsText(bot: Bot): string {
  return bot.card.legs
    .map((leg) => `${leg.direction === "long" ? "L" : "S"} ${leg.symbol} ${leg.leverage}x`)
    .join(" · ");
}

type BotsProps = { onSelectTab: (key: TabKey) => void };

export function Bots({ onSelectTab }: BotsProps) {
  const insets = useSafeAreaInsets();
  const [bots, setBots] = useState<Bot[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<BotMode>("guard");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => subscribeBots(setBots), []);

  async function create() {
    setHint(null);
    try {
      const problem = await draftBot(prompt, mode);
      if (problem) setHint(problem);
      else setPrompt("");
    } catch (error) {
      setHint(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Bots</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.label}>NEW BOT</Text>
          <Text style={styles.muted}>
            Bots run while the app is open and signed in. Every action is logged with its transaction.
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="long MON short BTC 2x $100 stop 8%"
            placeholderTextColor={dark.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <View style={styles.segment}>
            {([["guard", "Guard"], ["auto", "Auto"]] as [BotMode, string][]).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setMode(key)}
                style={[styles.segmentItem, mode === key && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentLabel, mode === key && styles.segmentLabelActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.muted}>
            {mode === "guard"
              ? "Closes an open position at your stop or target."
              : "Opens when funding carry passes your minimum, then guards it."}
          </Text>
          <Pressable onPress={() => void create()} style={styles.primary}>
            <Text style={styles.primaryLabel}>Create bot</Text>
          </Pressable>
          {hint !== null && <Text style={styles.error}>{hint}</Text>}
        </View>

        {bots.length === 0 ? (
          <Text style={styles.empty}>No bots yet.</Text>
        ) : (
          bots.map((bot) => (
            <View key={bot.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{bot.name}</Text>
                <Text style={styles.pill}>{bot.mode === "auto" ? "Auto" : "Guard"}</Text>
                <Text style={[styles.pill, (bot.status === "watching" || bot.status === "open") && styles.pillOn, (bot.status === "halted" || bot.status === "stopped") && styles.pillOff]}>
                  {bot.status}
                </Text>
              </View>
              <Text style={styles.muted}>
                {legsText(bot)} · Margin {usd(bot.card.marginUsd)} · Stop {bot.card.stopLossPct}% · Target{" "}
                {bot.card.takeProfitPct === undefined ? "none" : `${bot.card.takeProfitPct}%`}
              </Text>
              <Text style={bot.realizedPnlUsd >= 0 ? styles.up : styles.down}>Realised {usd(bot.realizedPnlUsd)}</Text>

              {bot.mode === "auto" && (
                <View style={styles.row}>
                  <View style={styles.rule}>
                    <Text style={styles.label}>MIN CARRY %</Text>
                    <TextInput
                      defaultValue={String(bot.rules.minCarryAprPct)}
                      keyboardType="numbers-and-punctuation"
                      onEndEditing={(event) => void updateBotRules(bot.id, { minCarryAprPct: Number(event.nativeEvent.text) || 0 })}
                      style={styles.smallInput}
                    />
                  </View>
                  <View style={styles.rule}>
                    <Text style={styles.label}>OPENS / DAY</Text>
                    <TextInput
                      defaultValue={String(bot.rules.maxOpensPerDay)}
                      keyboardType="number-pad"
                      onEndEditing={(event) => void updateBotRules(bot.id, { maxOpensPerDay: Math.max(1, Number(event.nativeEvent.text) || 1) })}
                      style={styles.smallInput}
                    />
                  </View>
                </View>
              )}

              {bot.lastCheck !== null && (
                <Text style={styles.muted}>
                  Checked {new Date(bot.lastCheck.at).toLocaleTimeString()}: {bot.lastCheck.message}
                </Text>
              )}

              {bot.log.slice(0, 5).map((entry) => (
                <Pressable
                  key={`${entry.at}-${entry.message}`}
                  disabled={!entry.txHash}
                  onPress={() => entry.txHash && void Linking.openURL(`${explorer}${entry.txHash}`)}
                >
                  <Text style={[styles.log, entry.level === "error" && styles.down, entry.level === "action" && styles.logAction]}>
                    {new Date(entry.at).toLocaleTimeString()} {entry.message}
                    {entry.txHash ? " · tx" : ""}
                  </Text>
                </Pressable>
              ))}

              <View style={styles.row}>
                <Pressable
                  onPress={() => void setBotEnabled(bot.id, !bot.enabled)}
                  style={[styles.action, !bot.enabled && styles.actionPrimary]}
                >
                  <Text style={[styles.actionLabel, !bot.enabled && styles.actionLabelPrimary]}>
                    {bot.enabled ? "Stop" : "Start"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void removeBot(bot.id)} style={styles.action}>
                  <Text style={styles.actionLabel}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TabBar active="bots" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  header: { paddingHorizontal: space.lg },
  heading: { fontFamily: family.semibold, fontSize: 25, letterSpacing: track(25, -0.04), color: dark.ink },
  content: { padding: space.lg, gap: space.lg },
  card: { padding: space.lg, borderRadius: 18, backgroundColor: dark.surface, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  label: { fontFamily: family.medium, fontSize: 11, letterSpacing: track(11, 0.12), color: dark.muted },
  muted: { fontFamily: family.regular, fontSize: 12, lineHeight: 12 * 1.5, color: dark.muted },
  error: { fontFamily: family.regular, fontSize: 12, color: dark.red },
  empty: { fontFamily: family.regular, fontSize: 13, color: dark.muted, textAlign: "center", paddingVertical: space.xl },
  up: { fontFamily: family.medium, fontSize: 13, color: dark.green },
  down: { fontFamily: family.medium, fontSize: 12, color: dark.red },
  input: { fontFamily: family.regular, fontSize: 15, color: dark.ink, padding: space.md, borderRadius: 12, borderWidth: 1, borderColor: dark.line },
  segment: { flexDirection: "row", borderRadius: 999, backgroundColor: dark.surfaceHover, padding: 3 },
  segmentItem: { flex: 1, minHeight: touch, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  segmentItemActive: { backgroundColor: dark.line },
  segmentLabel: { fontFamily: family.medium, fontSize: 13, color: dark.muted },
  segmentLabelActive: { color: dark.ink },
  primary: { minHeight: touch + space.md, borderRadius: 999, backgroundColor: dark.accent, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.onAccent },
  name: { fontFamily: family.semibold, fontSize: 15, color: dark.ink },
  pill: { fontFamily: family.medium, fontSize: 11, color: dark.muted, backgroundColor: dark.surfaceHover, paddingVertical: 3, paddingHorizontal: space.sm, borderRadius: 999, overflow: "hidden" },
  pillOn: { color: dark.green },
  pillOff: { color: dark.red },
  rule: { flex: 1, gap: space.xs },
  smallInput: { fontFamily: family.regular, fontSize: 14, color: dark.ink, padding: space.sm, borderRadius: 10, borderWidth: 1, borderColor: dark.line },
  log: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  logAction: { color: dark.ink },
  action: { flex: 1, minHeight: touch, borderRadius: 999, backgroundColor: dark.surfaceHover, alignItems: "center", justifyContent: "center" },
  actionPrimary: { backgroundColor: dark.accent },
  actionLabel: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
  actionLabelPrimary: { color: dark.onAccent },
});
