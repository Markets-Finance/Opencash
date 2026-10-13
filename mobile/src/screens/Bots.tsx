import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bot, BotMode } from "shared";
import { Mark } from "../components/Mark";
import { LiveBots } from "../components/LiveBots";
import { PaperBots } from "../components/PaperBots";
import { StrategyLab } from "../components/StrategyLab";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { CardTitle, RoundButton, ScreenTitle, SelectPill, Switcher, Tag, ToneCard, tone } from "../components/ui";
import { loadAccount, loadCollateralBalance } from "../lib/perpl";
import { currentTrader, draftBot, draftCard, removeBot, setBotEnabled, subscribeBots, updateBotRules } from "../lib/bots";
import { actServerBot, createServerBot, loadServerBots } from "../lib/serverBots";
import { ServerRunning } from "../components/ServerRunning";
import { dark, family, space, touch } from "../theme";
import { explorer as networkExplorer } from "../lib/network";

const explorer = `${networkExplorer}/tx/`;
const botMinUsd = 10;

const ideas = [
  { text: "long MON short BTC 2x $100 stop 8%", fill: tone.sky },
  { text: "long ETH 3x $50 stop 6% tp 12%", fill: tone.lime },
  { text: "short SOL 2x $80 stop 10%", fill: tone.butter },
];

function usd(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusDot(bot: Bot): string {
  if (bot.status === "watching" || bot.status === "open") return dark.green;
  if (bot.status === "halted" || bot.status === "stopped") return dark.red;
  return dark.muted;
}

type BotsProps = { name?: string; labSymbol?: string | null; onSelectTab: (key: TabKey) => void; onOpenAsset: (symbol: string) => void; onOpenBot: (id: string, server: boolean) => void };

export function Bots({ name, labSymbol, onSelectTab, onOpenAsset, onOpenBot }: BotsProps) {
  const insets = useSafeAreaInsets();
  const [bots, setBots] = useState<Bot[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<BotMode>("guard");
  const [signal, setSignal] = useState<"nansen" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [view, setView] = useState<"strategies" | "agent">("strategies");
  const [liveKey, setLiveKey] = useState(0);
  const [runOn, setRunOn] = useState<"server" | "app">("server");
  const [serverBots, setServerBots] = useState<Bot[]>([]);
  const [hasKey, setHasKey] = useState(true);
  const [funding, setFunding] = useState({ perpl: 0, wallet: 0 });

  useEffect(() => {
    const trader = currentTrader();
    if (!trader) return;
    void Promise.all([loadAccount(trader.address).catch(() => null), loadCollateralBalance(trader.address).catch(() => 0)]).then(([account, wallet]) =>
      setFunding({ perpl: account === null ? 0 : account.balance - account.lockedBalance, wallet }),
    );
  }, []);

  useEffect(() => subscribeBots(setBots), []);

  const refreshServer = useCallback(async () => {
    try {
      const next = await loadServerBots();
      setServerBots(next.bots as Bot[]);
      setHasKey(next.hasKey);
    } catch {
      setServerBots([]);
    }
  }, []);

  useEffect(() => {
    void refreshServer();
    const timer = setInterval(() => void refreshServer(), 15_000);
    return () => clearInterval(timer);
  }, [refreshServer]);

  async function toggle(bot: Bot, server: boolean) {
    setHint(null);
    try {
      if (server) await actServerBot(bot.id, bot.enabled ? "disable" : "enable");
      else await setBotEnabled(bot.id, !bot.enabled);
    } catch (error) {
      setHint(error instanceof Error ? error.message : String(error));
    }
    if (server) await refreshServer();
  }

  async function discard(bot: Bot, server: boolean) {
    try {
      if (server) await actServerBot(bot.id, "remove");
      else await removeBot(bot.id);
    } catch (error) {
      setHint(error instanceof Error ? error.message : String(error));
    }
    if (server) await refreshServer();
  }

  async function create() {
    setHint(null);
    if (prompt.trim() === "") {
      setHint("Describe a trade first, or tap one of the ideas.");
      return;
    }
    try {
      if (runOn === "server") {
        const { card, problem: unclear } = await draftCard(prompt, signal);
        if (card === null) {
          setHint(unclear);
          return;
        }
        await createServerBot(card, mode);
        await refreshServer();
        setPrompt("");
        setHint(hasKey ? "Bot saved on the server. Press Start to run it." : "Bot saved. Turn on server running below, then press Start.");
        return;
      }
      const problem = await draftBot(prompt, mode, signal);
      if (problem) setHint(problem);
      else {
        setPrompt("");
        setHint("Bot added below. Press Start to run it.");
      }
    } catch (error) {
      setHint(error instanceof Error ? error.message : String(error));
    }
  }

  const items = [...serverBots.map((bot) => ({ bot, server: true })), ...bots.map((bot) => ({ bot, server: false }))];
  const running = items.filter((item) => item.bot.enabled).length;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: tabBarHeight + insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title="Bots" right={<Tag label={`${running} running`} dot={running > 0 ? dark.green : dark.muted} />} />
        {funding.perpl < botMinUsd && (
          <View style={styles.depositNote}>
            <Text style={styles.depositNoteText}>
              {funding.wallet >= botMinUsd
                ? `You have ${usd(funding.wallet)} AUSD in your wallet but ${usd(funding.perpl)} in Perpl. Bots trade from your Perpl account, so move at least $${botMinUsd} there first (Account, Move between accounts).`
                : `Deposit at least $${botMinUsd} before starting a bot. A bot skips any order under $${botMinUsd}, so it can't trade with less.`}
            </Text>
          </View>
        )}

        <Switcher
          items={[
            { key: "strategies", label: "Strategies", dot: tone.butter, count: 4 },
            { key: "agent", label: "Agent", dot: tone.violet, count: items.length },
          ]}
          value={view}
          onChange={setView}
        />

        {view === "strategies" && (
          <>
            <StrategyLab initialSymbol={labSymbol} onOpenAsset={onOpenAsset} onLive={() => setLiveKey((k) => k + 1)} />
            <PaperBots onOpenAsset={onOpenAsset} />
            <LiveBots refreshKey={liveKey} onOpenAsset={onOpenAsset} />
          </>
        )}

        {view === "agent" && (
        <>
        <ToneCard>
          <CardTitle>Agent</CardTitle>
          <View style={styles.messageRow}>
            <View style={styles.avatar}>
              <Mark size={20} tint={dark.onAccent} />
            </View>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                Hi{name ? `, ${name}` : ""}. Tell me a trade in one line. I turn it into a card with a stop, and a bot guards it. On the server it keeps running when the app is closed.
                {items.length > 0 ? ` You have ${items.length} bot${items.length === 1 ? "" : "s"} set up.` : ""}
              </Text>
            </View>
          </View>

          <View style={styles.ideas}>
            {ideas.map((idea) => (
              <Pressable
                key={idea.text}
                onPress={() => setPrompt(idea.text)}
                style={({ pressed }) => [styles.idea, { backgroundColor: idea.fill }, pressed && styles.pressed]}
              >
                <Text style={styles.ideaText}>{idea.text}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modes}>
            <SelectPill label="On server" active={runOn === "server"} onPress={() => setRunOn("server")} />
            <SelectPill label="In app" active={runOn === "app"} onPress={() => setRunOn("app")} />
            <Text style={styles.modeNote} numberOfLines={2}>
              {runOn === "server" ? "Keeps running when the app is closed." : "Runs only while the app is open."}
            </Text>
          </View>

          <View style={styles.modes}>
            <SelectPill label="Guard" active={mode === "guard"} onPress={() => setMode("guard")} />
            <SelectPill label="Auto" active={mode === "auto"} onPress={() => setMode("auto")} />
            <Text style={styles.modeNote} numberOfLines={2}>
              {mode === "guard" ? "Closes at your stop or target." : "Opens on funding carry, then guards."}
            </Text>
          </View>

          <View style={styles.modes}>
            <SelectPill label="No signal" active={signal === null} onPress={() => setSignal(null)} />
            <SelectPill label="Nansen" active={signal === "nansen"} onPress={() => setSignal("nansen")} />
            <Text style={styles.modeNote} numberOfLines={2}>
              {signal === "nansen" ? "Opens only when smart money agrees." : "Optional: gate trades on smart money."}
            </Text>
          </View>

          <View style={styles.inputRow}>
            <RoundButton glyph="+" label="Create bot" fill={tone.coral} onPress={() => void create()} />
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe a trade to start"
              placeholderTextColor={dark.muted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => void create()}
              style={styles.input}
            />
          </View>
          {hint !== null && <Text style={styles.hint}>{hint}</Text>}
        </ToneCard>

        {runOn === "server" && !hasKey && (
          <ToneCard>
            <ServerRunning hasKey={hasKey} onChanged={() => void refreshServer()} />
          </ToneCard>
        )}

        <Text style={styles.section}>YOUR BOTS</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>No bots yet. Describe a trade above or start a paper bot.</Text>
        ) : (
          items.map(({ bot, server }) => (
            <ToneCard key={bot.id}>
              <Pressable onPress={() => onOpenBot(bot.id, server)} accessibilityRole="button" accessibilityLabel={`Open ${bot.name}`} style={styles.botHead}>
                <Text style={styles.botName} numberOfLines={1}>
                  {bot.name.toUpperCase()} ↗
                </Text>
                <Tag label={server ? "Server" : "In app"} />
                <Tag label={bot.mode === "auto" ? "Auto" : "Guard"} />
                <Tag label={bot.status} dot={statusDot(bot)} />
              </Pressable>
              <View style={styles.tags}>
                {bot.card.legs.map((leg) => (
                  <Pressable key={`${leg.symbol}-${leg.direction}`} onPress={() => onOpenAsset(leg.symbol)} accessibilityLabel={`Trade ${leg.symbol}`}>
                    <Tag label={`${leg.direction === "long" ? "Long" : "Short"} ${leg.symbol} ${leg.leverage}x ↗`} dot={leg.direction === "long" ? dark.green : dark.red} />
                  </Pressable>
                ))}
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Margin</Text>
                  <Text style={styles.statValue}>{usd(bot.card.marginUsd)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Stop</Text>
                  <Text style={styles.statValue}>{bot.card.stopLossPct}%</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Realised</Text>
                  <Text style={[styles.statValue, { color: bot.realizedPnlUsd >= 0 ? dark.green : dark.red }]}>{usd(bot.realizedPnlUsd)}</Text>
                </View>
              </View>

              {bot.mode === "auto" && !server && (
                <View style={styles.rules}>
                  <View style={styles.rule}>
                    <Text style={styles.statLabel}>Min carry %</Text>
                    <TextInput
                      defaultValue={String(bot.rules.minCarryAprPct)}
                      keyboardType="numbers-and-punctuation"
                      onEndEditing={(event) => void updateBotRules(bot.id, { minCarryAprPct: Number(event.nativeEvent.text) || 0 })}
                      style={styles.smallInput}
                    />
                  </View>
                  <View style={styles.rule}>
                    <Text style={styles.statLabel}>Opens / day</Text>
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

              {bot.log.slice(0, 4).map((entry) => (
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

              <View style={styles.actions}>
                <Pressable
                  onPress={() => void toggle(bot, server)}
                  style={({ pressed }) => [styles.action, { backgroundColor: bot.enabled ? tone.paper : tone.coral }, pressed && styles.pressed]}
                >
                  <Text style={styles.actionLabel}>{bot.enabled ? "Stop" : "Start"}</Text>
                </Pressable>
                <Pressable onPress={() => void discard(bot, server)} style={({ pressed }) => [styles.action, styles.actionQuiet, pressed && styles.pressed]}>
                  <Text style={styles.actionQuietLabel}>Delete</Text>
                </Pressable>
              </View>
            </ToneCard>
          ))
        )}
        </>
        )}
      </ScrollView>

      <TabBar active="bots" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  pressed: { opacity: 0.75 },
  messageRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: tone.violet, alignItems: "center", justifyContent: "center" },
  bubble: { flex: 1, padding: space.md, borderRadius: 20, borderTopLeftRadius: 6, backgroundColor: tone.raised },
  bubbleText: { fontFamily: family.regular, fontSize: 14, lineHeight: 21, color: dark.ink },
  ideas: { alignItems: "flex-end", gap: space.sm },
  idea: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: 999 },
  ideaText: { fontFamily: family.medium, fontSize: 13, color: tone.ink },
  modes: { flexDirection: "row", alignItems: "center", gap: space.sm },
  modeNote: { flex: 1, fontFamily: family.regular, fontSize: 12, lineHeight: 16, color: dark.muted },
  inputRow: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.xs, borderRadius: 999, backgroundColor: dark.paper },
  input: { flex: 1, minHeight: touch, fontFamily: family.regular, fontSize: 14, color: dark.ink, paddingHorizontal: space.sm },
  hint: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  section: { fontFamily: family.semibold, fontSize: 22, letterSpacing: -0.8, color: dark.ink, marginTop: space.sm },
  empty: { fontFamily: family.regular, fontSize: 13, color: dark.muted },
  botHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  botName: { flex: 1, fontFamily: family.semibold, fontSize: 18, letterSpacing: -0.6, color: dark.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  stats: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, padding: space.md, borderRadius: 18, backgroundColor: tone.raised, gap: 2 },
  statLabel: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  statValue: { fontFamily: family.medium, fontSize: 15, color: dark.ink },
  rules: { flexDirection: "row", gap: space.sm },
  rule: { flex: 1, gap: space.xs },
  smallInput: { fontFamily: family.regular, fontSize: 14, color: dark.ink, padding: space.sm, borderRadius: 12, backgroundColor: tone.raised },
  muted: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  depositNote: { padding: space.md, borderRadius: 16, backgroundColor: "rgba(123, 115, 240, 0.16)" },
  depositNoteText: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.ink },
  log: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  logAction: { color: dark.ink },
  down: { color: dark.red },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1, minHeight: touch + space.xs, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontFamily: family.semibold, fontSize: 14, color: tone.ink },
  actionQuiet: { backgroundColor: tone.raised },
  actionQuietLabel: { fontFamily: family.medium, fontSize: 14, color: dark.muted },
});
