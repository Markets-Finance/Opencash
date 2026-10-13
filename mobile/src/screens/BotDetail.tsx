import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bot, TradingAccount } from "shared";
import { AssetMark } from "../components/AssetMark";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { ScreenTitle, Tag, ToneCard, tone } from "../components/ui";
import { removeBot, setBotEnabled, subscribeBots } from "../lib/bots";
import { loadAccount } from "../lib/perpl";
import { actServerBot, loadServerBots } from "../lib/serverBots";
import { removePaperCard, subscribePaperCards, togglePaperCard } from "../lib/paperCard";
import type { BotKind } from "./Bots";
import { explorer as networkExplorer } from "../lib/network";
import { dark, family, space, touch } from "../theme";

const explorer = `${networkExplorer}/tx/`;

function usd(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function describe(bot: Bot): string {
  const legs = bot.card.legs.map((leg) => `${leg.direction} ${leg.symbol} ${leg.leverage}x`).join(" and ");
  const target = bot.card.takeProfitPct ? ` and a ${bot.card.takeProfitPct}% target` : "";
  if (bot.mode === "guard") {
    return `Guard bot. It does not open trades. When you hold ${legs}, it places a ${bot.card.stopLossPct}% stop${target} on Perpl and cancels them if the position closes.`;
  }
  return `Auto bot. It opens ${legs} on its own with ${usd(bot.card.marginUsd)} margin when funding carry is at least ${bot.rules.minCarryAprPct}% APR. It waits ${bot.rules.cooldownMin} minutes between opens and opens at most ${bot.rules.maxOpensPerDay} a day. It places a ${bot.card.stopLossPct}% stop${target}.`;
}

type Check = { ok: boolean | null; label: string; fix: string };

type BotDetailProps = {
  trader: TradingAccount;
  botId: string;
  kind: BotKind;
  onBack: () => void;
  onOpenAsset: (symbol: string) => void;
  onSelectTab: (key: TabKey) => void;
};

export function BotDetail({ trader, botId, kind, onBack, onOpenAsset, onSelectTab }: BotDetailProps) {
  const insets = useSafeAreaInsets();
  const server = kind === "live";
  const [bot, setBot] = useState<Bot | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [runner, setRunner] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!server) return;
    try {
      const next = await loadServerBots();
      setBot((next.bots as Bot[]).find((entry) => entry.id === botId) ?? null);
      setHasKey(next.hasKey);
      setRunner(next.runner);
    } catch {
      setHasKey(null);
    }
  }, [server, botId]);

  useEffect(() => {
    if (server) {
      void refresh();
      const timer = setInterval(() => void refresh(), 10_000);
      return () => clearInterval(timer);
    }
    if (kind === "paper") return subscribePaperCards((all) => setBot((all.find((entry) => entry.id === botId) as Bot | undefined) ?? null));
    return subscribeBots((all) => setBot(all.find((entry) => entry.id === botId) ?? null));
  }, [server, kind, refresh, botId]);

  useEffect(() => {
    loadAccount(trader.address)
      .then((account) => setBalance(account === null ? 0 : account.balance - account.lockedBalance))
      .catch(() => setBalance(null));
  }, [trader.address]);

  async function toggle() {
    if (!bot) return;
    setHint(null);
    try {
      if (kind === "paper") await togglePaperCard(bot.id);
      else if (server) await actServerBot(bot.id, bot.enabled ? "disable" : "enable");
      else await setBotEnabled(bot.id, !bot.enabled);
      await refresh();
    } catch (error) {
      setHint(error instanceof Error ? error.message : String(error));
    }
  }

  async function discard() {
    if (!bot) return;
    try {
      if (kind === "paper") removePaperCard(bot.id);
      else if (server) await actServerBot(bot.id, "remove");
      else await removeBot(bot.id);
      onBack();
    } catch (error) {
      setHint(error instanceof Error ? error.message : String(error));
    }
  }

  const checks: Check[] = bot
    ? [
        ...(kind === "paper"
          ? [{ ok: true, label: "Paper bot: fake money, no server needed", fix: "" }]
          : server
          ? [
              { ok: hasKey, label: "Server running is on", fix: "Open the Agent tab and tap Turn on server running." },
              { ok: runner, label: "The server bot runner is live", fix: "The runner is paused. Try again shortly." },
            ]
          : [{ ok: true, label: "Runs inside this app", fix: "Keep the app open for it to act." }]),
        ...(kind === "paper"
          ? []
          : [
              {
                ok: balance === null ? null : balance >= bot.card.marginUsd,
                label: `Perpl account holds ${usd(bot.card.marginUsd)} AUSD (now ${balance === null ? "…" : usd(balance)})`,
                fix: "Move AUSD into your Perpl account from Account, Move between accounts, or open any trade once to fund it.",
              },
            ]),
        { ok: bot.enabled, label: "The bot is started", fix: "Tap Start below." },
      ]
    : [];
  const ready = checks.length > 0 && checks.every((check) => check.ok === true);
  const trades = bot ? bot.log.filter((entry) => entry.level === "action") : [];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: tabBarHeight + insets.bottom + space.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title={bot?.name ?? "Bot"} onBack={onBack} />
        {bot === null ? (
          <Text style={styles.muted}>This bot is not available any more.</Text>
        ) : (
          <>
            <View style={styles.tags}>
              <Tag label={kind === "live" ? "Live" : kind === "paper" ? "Paper" : "In app"} />
              <Tag label={bot.mode === "auto" ? "Auto" : "Guard"} />
              <Tag label={bot.status} dot={bot.status === "halted" || bot.status === "stopped" ? dark.red : bot.status === "idle" ? dark.muted : dark.green} />
            </View>

            <ToneCard fill={ready ? tone.lime : tone.butter}>
              <Text style={styles.cardTitle}>{ready ? "Running. It will act when its rule fires." : "Not ready to trade yet"}</Text>
              {checks.map((check) => (
                <View key={check.label} style={styles.checkRow}>
                  <Text style={styles.checkMark}>{check.ok === null ? "…" : check.ok ? "✓" : "✗"}</Text>
                  <View style={styles.checkText}>
                    <Text style={styles.checkLabel}>{check.label}</Text>
                    {check.ok === false && <Text style={styles.checkFix}>{check.fix}</Text>}
                  </View>
                </View>
              ))}
            </ToneCard>

            <Text style={styles.section}>WHAT IT DOES</Text>
            <Text style={styles.body}>{describe(bot)}</Text>

            <Text style={styles.section}>ACTING ON</Text>
            {bot.card.legs.map((leg) => (
              <Pressable key={`${leg.symbol}-${leg.direction}`} onPress={() => onOpenAsset(leg.symbol)} style={({ pressed }) => [styles.leg, pressed && styles.pressed]}>
                <AssetMark symbol={leg.symbol} size={36} />
                <View style={styles.legText}>
                  <Text style={styles.legTitle}>{leg.direction === "long" ? "Long" : "Short"} {leg.symbol}</Text>
                  <Text style={styles.muted}>{leg.leverage}x · {leg.weightBps / 100}% of margin</Text>
                </View>
                <Text style={styles.chev}>↗</Text>
              </Pressable>
            ))}

            <View style={styles.stats}>
              <View style={styles.stat}><Text style={styles.statLabel}>Margin</Text><Text style={styles.statValue}>{usd(bot.card.marginUsd)}</Text></View>
              <View style={styles.stat}><Text style={styles.statLabel}>Stop</Text><Text style={styles.statValue}>{bot.card.stopLossPct}%</Text></View>
              <View style={styles.stat}><Text style={styles.statLabel}>Target</Text><Text style={styles.statValue}>{bot.card.takeProfitPct ? `${bot.card.takeProfitPct}%` : "—"}</Text></View>
              <View style={styles.stat}><Text style={styles.statLabel}>{kind === "paper" ? "Paper result" : "Realised"}</Text><Text style={[styles.statValue, { color: bot.realizedPnlUsd >= 0 ? dark.green : dark.red }]}>{usd(bot.realizedPnlUsd)}</Text></View>
            </View>
            {bot.lastCheck !== null && <Text style={styles.muted}>Last check {new Date(bot.lastCheck.at).toLocaleTimeString()}: {bot.lastCheck.message}</Text>}

            <Text style={styles.section}>TRADES AND ORDERS</Text>
            {trades.length === 0 ? (
              <Text style={styles.muted}>Nothing placed yet. Orders and stops this bot sends will appear here with a link to the transaction.</Text>
            ) : (
              trades.map((entry) => (
                <Pressable key={`${entry.at}-${entry.message}`} disabled={!entry.txHash} onPress={() => entry.txHash && void Linking.openURL(`${explorer}${entry.txHash}`)} style={styles.trade}>
                  <Text style={styles.tradeTime}>{new Date(entry.at).toLocaleString()}</Text>
                  <Text style={styles.tradeText}>{entry.message}{entry.txHash ? "  ↗ tx" : ""}</Text>
                </Pressable>
              ))
            )}

            <Text style={styles.section}>LOG</Text>
            {bot.log.length === 0 ? (
              <Text style={styles.muted}>No activity yet. Once started, each check and action is written here.</Text>
            ) : (
              bot.log.map((entry) => (
                <Text key={`${entry.at}-${entry.message}-log`} style={[styles.log, entry.level === "error" && styles.down, entry.level === "action" && styles.logAction]}>
                  {new Date(entry.at).toLocaleTimeString()} {entry.message}
                </Text>
              ))
            )}

            {hint !== null && <Text style={styles.down}>{hint}</Text>}
            <View style={styles.actions}>
              <Pressable onPress={() => void toggle()} style={({ pressed }) => [styles.action, { backgroundColor: bot.enabled ? tone.paper : tone.coral }, pressed && styles.pressed]}>
                <Text style={styles.actionLabel}>{bot.enabled ? "Stop" : "Start"}</Text>
              </Pressable>
              <Pressable onPress={() => void discard()} style={({ pressed }) => [styles.action, styles.actionQuiet, pressed && styles.pressed]}>
                <Text style={styles.actionQuietLabel}>Delete</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
      <TabBar active="bots" onSelect={onSelectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  content: { paddingHorizontal: space.lg, gap: space.md },
  pressed: { opacity: 0.75 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  cardTitle: { fontFamily: family.semibold, fontSize: 18, letterSpacing: -0.4, color: tone.ink },
  checkRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  checkMark: { width: 18, fontFamily: family.semibold, fontSize: 15, color: tone.ink },
  checkText: { flex: 1, gap: 2 },
  checkLabel: { fontFamily: family.medium, fontSize: 14, color: tone.ink },
  checkFix: { fontFamily: family.regular, fontSize: 12, lineHeight: 17, color: "rgba(20, 24, 26, 0.75)" },
  section: { marginTop: space.md, fontFamily: family.semibold, fontSize: 13, letterSpacing: 1, color: dark.muted },
  body: { fontFamily: family.regular, fontSize: 15, lineHeight: 22, color: dark.ink },
  muted: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  leg: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingHorizontal: space.md, borderRadius: 20, backgroundColor: tone.card },
  legText: { flex: 1, gap: 2 },
  legTitle: { fontFamily: family.semibold, fontSize: 16, color: dark.ink },
  chev: { fontFamily: family.medium, fontSize: 18, color: dark.muted },
  stats: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, padding: space.md, borderRadius: 16, backgroundColor: tone.card, gap: 2 },
  statLabel: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  statValue: { fontFamily: family.semibold, fontSize: 15, color: dark.ink },
  trade: { padding: space.md, borderRadius: 16, backgroundColor: tone.card, gap: 2 },
  tradeTime: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  tradeText: { fontFamily: family.medium, fontSize: 14, lineHeight: 20, color: dark.ink },
  log: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  logAction: { color: dark.ink },
  down: { fontFamily: family.regular, fontSize: 12, color: dark.red },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  action: { flex: 1, minHeight: touch, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontFamily: family.semibold, fontSize: 15, color: tone.ink },
  actionQuiet: { backgroundColor: tone.raised },
  actionQuietLabel: { fontFamily: family.medium, fontSize: 15, color: dark.ink },
});
