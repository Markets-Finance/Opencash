import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { agentMemoryNamespace, loadVault, saveVault, type AgentTurn, type Bot, type BotMode, type NamespaceSession } from "shared";
import { backendUrl } from "../lib/config";
import { openNamespace } from "../lib/mera";
import { Mark } from "../components/Mark";
import { ServerRunning } from "../components/ServerRunning";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { ScreenTitle, SelectPill, Tag, ToneCard, tone } from "../components/ui";
import { currentTrader, draftCard, subscribeBots } from "../lib/bots";
import { loadAccount, loadCollateralBalance } from "../lib/perpl";
import { addPaperCard, subscribePaperCards, type PaperBot } from "../lib/paperCard";
import { botMinUsd, loadServerBots, startLiveFromCard } from "../lib/serverBots";
import { dark, family, space, touch } from "../theme";

export type BotKind = "live" | "paper" | "app";

const ideas = [
  { text: "Long BTC with the smallest safe size, 2x, stop 6%", label: "Safe BTC long", fill: tone.lime },
  { text: "Pair trade: long MON, short BTC, 2x, stop 8%", label: "MON vs BTC pair", fill: tone.sky },
  { text: "Short PUMP 2x with a tight stop and a 10% target", label: "Short PUMP", fill: tone.butter },
  { text: "Use my whole free Perpl balance on the best funding carry right now", label: "Best funding carry", fill: tone.peach },
];

type Message = { role: "me" | "agent"; text: string };

function usd(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusDot(bot: Bot): string {
  if (bot.status === "watching" || bot.status === "open") return dark.green;
  if (bot.status === "halted" || bot.status === "stopped") return dark.red;
  return dark.muted;
}

type BotsProps = {
  name?: string;
  onSelectTab: (key: TabKey) => void;
  onOpenAsset: (symbol: string) => void;
  onOpenBot: (id: string, kind: BotKind) => void;
};

export function Bots({ name, onSelectTab, onOpenAsset, onOpenBot }: BotsProps) {
  const insets = useSafeAreaInsets();
  const [localBots, setLocalBots] = useState<Bot[]>([]);
  const [serverBots, setServerBots] = useState<Bot[]>([]);
  const [papers, setPapers] = useState<PaperBot[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [funding, setFunding] = useState({ perpl: 0, wallet: 0 });
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState<Bot["card"] | null>(null);
  const [kind, setKind] = useState<"paper" | "live">("paper");
  const [mode, setMode] = useState<BotMode>("auto");
  const [starting, setStarting] = useState(false);
  const [memoryOn, setMemoryOn] = useState(false);
  const [memoryNote, setMemoryNote] = useState<string | null>(null);
  const memory = useRef<NamespaceSession | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [startNote, setStartNote] = useState<{ text: string; failed: boolean } | null>(null);

  useEffect(() => subscribeBots(setLocalBots), []);
  useEffect(() => subscribePaperCards(setPapers), []);

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

  useEffect(() => {
    const trader = currentTrader();
    if (!trader) return;
    void Promise.all([loadAccount(trader.address).catch(() => null), loadCollateralBalance(trader.address).catch(() => 0)]).then(([account, wallet]) =>
      setFunding({ perpl: account === null ? 0 : account.balance - account.lockedBalance, wallet }),
    );
  }, [serverBots.length]);

  function rememberSoon(nextMessages: Message[], nextDraft: Bot["card"] | null) {
    const session = memory.current;
    const trader = currentTrader();
    if (!session || !trader) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveVault(backendUrl, trader, agentMemoryNamespace, JSON.stringify({ messages: nextMessages.slice(-40), card: nextDraft }), session).catch(() => {});
    }, 1500);
  }

  async function unlockMemory() {
    const trader = currentTrader();
    if (!trader) return;
    setMemoryNote("Waiting for your passkey…");
    try {
      memory.current ??= await openNamespace(agentMemoryNamespace);
      const saved = await loadVault(backendUrl, trader, agentMemoryNamespace, memory.current);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as { messages?: Message[]; card?: Bot["card"] | null };
        if (Array.isArray(parsed.messages)) setMessages(parsed.messages.slice(-40));
        if (parsed.card) setDraft(parsed.card);
      }
      setMemoryOn(true);
      setMemoryNote("Memory on. Chats are sealed with your passkey and follow you to any device.");
    } catch (error) {
      setMemoryNote(error instanceof Error ? error.message : String(error));
    }
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed === "" || thinking) return;
    setPrompt("");
    setStartNote(null);
    const earlier: AgentTurn[] = messages.slice(-8).map((message) => ({ role: message.role === "me" ? "user" : "assistant", content: message.text }));
    const asked: Message[] = [...messages, { role: "me", text: trimmed }];
    setMessages(asked);
    setThinking(true);
    try {
      const { card, problem, note } = await draftCard(trimmed, null, earlier);
      if (card === null) {
        const next: Message[] = [...asked, { role: "agent", text: problem ?? "I could not draft that." }];
        setMessages(next);
        rememberSoon(next, draft);
      } else {
        setDraft(card);
        const next: Message[] = [...asked, { role: "agent", text: note && note !== "" ? note : "Drafted. Check the bot below, then start it in Paper or Live." }];
        setMessages(next);
        rememberSoon(next, card);
      }
    } catch (error) {
      setMessages((current) => [...current, { role: "agent", text: error instanceof Error ? error.message : String(error) }]);
    } finally {
      setThinking(false);
    }
  }

  function edit(field: "marginUsd" | "stopLossPct" | "takeProfitPct", value: string) {
    if (!draft) return;
    const number = Number(value);
    setDraft({ ...draft, [field]: value.trim() === "" && field === "takeProfitPct" ? undefined : Number.isFinite(number) ? number : 0 });
  }

  async function start() {
    if (!draft || starting) return;
    setStarting(true);
    setStartNote(null);
    try {
      if (kind === "paper") {
        await addPaperCard(draft, mode);
        setStartNote({ text: "Paper bot is running with fake money. Watch it under Your bots.", failed: false });
      } else {
        const text = await startLiveFromCard(draft, mode, (step) => setStartNote({ text: step, failed: false }));
        setStartNote({ text, failed: false });
        await refreshServer();
      }
      setDraft(null);
    } catch (error) {
      setStartNote({ text: error instanceof Error ? error.message : String(error), failed: true });
    } finally {
      setStarting(false);
    }
  }

  const items = [
    ...serverBots.map((bot) => ({ bot: bot as Bot, kind: "live" as BotKind })),
    ...papers.map((bot) => ({ bot: bot as Bot, kind: "paper" as BotKind })),
    ...localBots.map((bot) => ({ bot, kind: "app" as BotKind })),
  ];
  const running = items.filter((item) => item.bot.enabled).length;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: tabBarHeight + insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title="Bots" right={<Tag label={`${running} running`} dot={running > 0 ? dark.green : dark.muted} />} />

        <ToneCard>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: hasKey ? dark.green : dark.muted }]} />
            <Text style={styles.cardTitle}>Autonomous trading {hasKey ? "is on" : "is off"}</Text>
          </View>
          <ServerRunning hasKey={hasKey} onChanged={() => void refreshServer()} />
        </ToneCard>

        {funding.perpl < botMinUsd && (
          <View style={styles.depositNote}>
            <Text style={styles.depositNoteText}>
              {funding.wallet >= botMinUsd
                ? `You have ${usd(funding.wallet)} AUSD in your wallet but ${usd(funding.perpl)} in Perpl. Live bots trade from Perpl, so move at least $${botMinUsd} there first (Account, Move between wallet and Perpl). Paper bots need no money.`
                : `Live bots need at least $${botMinUsd} in Perpl. Paper bots need no money.`}
            </Text>
          </View>
        )}

        <ToneCard>
          <Text style={styles.cardTitle}>Agent</Text>
          <View style={styles.messageRow}>
            <View style={styles.avatar}>
              <Mark size={20} tint={dark.onAccent} />
            </View>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                Hi{name ? `, ${name}` : ""}. Tell me a trade in plain words. I check your balance and the markets, then draft a bot. You choose Paper or Live. I only draft and never move funds.
              </Text>
            </View>
          </View>
          {!memoryOn && (
            <Pressable onPress={() => void unlockMemory()} style={({ pressed }) => [styles.memory, pressed && styles.pressed]}>
              <Text style={styles.memoryLabel}>🔒 Unlock memory</Text>
            </Pressable>
          )}
          {memoryNote !== null && <Text style={styles.hint}>{memoryNote}</Text>}
          {messages.map((message, index) => (
            <View key={index} style={[styles.messageRow, message.role === "me" && styles.messageMe]}>
              <View style={[styles.bubble, message.role === "me" && styles.bubbleMe]}>
                <Text style={[styles.bubbleText, message.role === "me" && styles.bubbleMeText]}>{message.text}</Text>
              </View>
            </View>
          ))}
          {thinking && <Text style={styles.hint}>Checking your balances and the markets…</Text>}
          <View style={styles.ideas}>
            {ideas.map((idea) => (
              <Pressable key={idea.label} onPress={() => void ask(idea.text)} style={({ pressed }) => [styles.idea, { backgroundColor: idea.fill }, pressed && styles.pressed]}>
                <Text style={styles.ideaText}>{idea.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Ask for a trade, e.g. long MON 2x stop 8%"
              placeholderTextColor={dark.muted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => void ask(prompt)}
              style={styles.input}
            />
            <Pressable onPress={() => void ask(prompt)} style={({ pressed }) => [styles.send, pressed && styles.pressed]}>
              <Text style={styles.sendLabel}>Send</Text>
            </Pressable>
          </View>
        </ToneCard>

        {draft !== null && (
          <ToneCard fill={tone.lime}>
            <Text style={styles.draftTitle}>{draft.name}</Text>
            <View style={styles.tags}>
              {draft.legs.map((leg) => (
                <Text key={`${leg.symbol}-${leg.direction}`} style={styles.draftLeg}>
                  {leg.direction === "long" ? "Long" : "Short"} {leg.symbol} {leg.leverage}x · {leg.weightBps / 100}%
                </Text>
              ))}
            </View>
            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Margin $</Text>
                <TextInput defaultValue={String(draft.marginUsd)} keyboardType="decimal-pad" onEndEditing={(event) => edit("marginUsd", event.nativeEvent.text)} style={styles.fieldInput} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Stop %</Text>
                <TextInput defaultValue={String(draft.stopLossPct)} keyboardType="decimal-pad" onEndEditing={(event) => edit("stopLossPct", event.nativeEvent.text)} style={styles.fieldInput} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Target %</Text>
                <TextInput defaultValue={draft.takeProfitPct === undefined ? "" : String(draft.takeProfitPct)} keyboardType="decimal-pad" onEndEditing={(event) => edit("takeProfitPct", event.nativeEvent.text)} style={styles.fieldInput} />
              </View>
            </View>
            <View style={styles.pills}>
              <SelectPill label="Paper · fake money" active={kind === "paper"} onPress={() => setKind("paper")} />
              <SelectPill label="Live · real money" active={kind === "live"} onPress={() => setKind("live")} />
            </View>
            <View style={styles.pills}>
              <SelectPill label="Open on start" active={draft.openOnStart === true} onPress={() => setDraft({ ...draft, openOnStart: draft.openOnStart === true ? undefined : true })} />
            </View>
            <View style={styles.pills}>
              <SelectPill label="Opens for me" active={mode === "auto"} onPress={() => setMode("auto")} />
              <SelectPill label="Guards my position" active={mode === "guard"} onPress={() => setMode("guard")} />
            </View>
            <Pressable disabled={starting} onPress={() => void start()} style={({ pressed }) => [styles.startButton, (pressed || starting) && styles.pressed]}>
              <Text style={styles.startLabel}>{starting ? "Working…" : kind === "paper" ? "Start paper bot" : "Start live bot"}</Text>
            </Pressable>
          </ToneCard>
        )}
        {startNote !== null && <Text style={[styles.hint, startNote.failed && styles.down]}>{startNote.text}</Text>}

        <Text style={styles.section}>YOUR BOTS</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>No bots yet. Ask the agent for a trade, then start it in Paper or Live.</Text>
        ) : (
          items.map(({ bot, kind: botKind }) => {
            const open = (bot as Partial<PaperBot>).unrealisedUsd;
            return (
              <Pressable key={bot.id} onPress={() => onOpenBot(bot.id, botKind)} accessibilityRole="button" accessibilityLabel={`Open ${bot.name}`} style={({ pressed }) => [styles.botRow, pressed && styles.pressed]}>
                <View style={styles.botTop}>
                  <Text style={styles.botName} numberOfLines={1}>
                    {bot.name.toUpperCase()}
                  </Text>
                  <Tag label={botKind === "live" ? "Live" : botKind === "paper" ? "Paper" : "In app"} />
                  <Tag label={bot.status} dot={statusDot(bot)} />
                </View>
                <Text style={styles.muted} numberOfLines={1}>
                  {bot.card.legs.map((leg) => `${leg.direction === "long" ? "Long" : "Short"} ${leg.symbol} ${leg.leverage}x`).join(" · ")} · {usd(bot.card.marginUsd)}
                </Text>
                <View style={styles.botBottom}>
                  <Text style={[styles.pnl, { color: bot.realizedPnlUsd + (open ?? 0) >= 0 ? dark.green : dark.red }]}>
                    {usd(bot.realizedPnlUsd + (open ?? 0))}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {bot.lastCheck ? bot.lastCheck.message : "Not started yet"}
                  </Text>
                </View>
              </Pressable>
            );
          })
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
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontFamily: family.semibold, fontSize: 18, letterSpacing: -0.4, color: dark.ink },
  messageRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  messageMe: { justifyContent: "flex-end" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: tone.violet, alignItems: "center", justifyContent: "center" },
  bubble: { flexShrink: 1, padding: space.md, borderRadius: 18, borderTopLeftRadius: 6, backgroundColor: tone.raised },
  bubbleMe: { backgroundColor: tone.lime, borderTopLeftRadius: 18, borderTopRightRadius: 6 },
  bubbleText: { fontFamily: family.regular, fontSize: 14, lineHeight: 20, color: dark.ink },
  bubbleMeText: { color: tone.ink },
  ideas: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  idea: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: 999 },
  ideaText: { fontFamily: family.medium, fontSize: 13, color: tone.ink },
  inputRow: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.xs, borderRadius: 999, backgroundColor: dark.paper },
  input: { flex: 1, minHeight: touch, fontFamily: family.regular, fontSize: 14, color: dark.ink, paddingHorizontal: space.md },
  memory: { alignSelf: "flex-start", paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: 999, backgroundColor: tone.raised },
  memoryLabel: { fontFamily: family.medium, fontSize: 12, color: dark.ink },
  send: { minHeight: touch, paddingHorizontal: space.lg, borderRadius: 999, backgroundColor: tone.violet, alignItems: "center", justifyContent: "center" },
  sendLabel: { fontFamily: family.semibold, fontSize: 14, color: "#ffffff" },
  hint: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  draftTitle: { fontFamily: family.semibold, fontSize: 22, letterSpacing: -0.6, color: tone.ink },
  tags: { gap: 2 },
  draftLeg: { fontFamily: family.medium, fontSize: 14, color: tone.ink },
  fields: { flexDirection: "row", gap: space.sm },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontFamily: family.regular, fontSize: 11, color: "rgba(20, 24, 26, 0.65)" },
  fieldInput: { fontFamily: family.semibold, fontSize: 16, color: tone.ink, padding: space.sm, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.55)" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  startButton: { minHeight: 52, borderRadius: 26, backgroundColor: tone.ink, alignItems: "center", justifyContent: "center" },
  startLabel: { fontFamily: family.semibold, fontSize: 16, color: "#ffffff" },
  section: { fontFamily: family.semibold, fontSize: 20, letterSpacing: -0.6, color: dark.ink, marginTop: space.sm },
  empty: { fontFamily: family.regular, fontSize: 13, color: dark.muted },
  botRow: { padding: space.md, borderRadius: 20, backgroundColor: tone.card, gap: space.xs },
  botTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  botName: { flex: 1, fontFamily: family.semibold, fontSize: 16, letterSpacing: -0.4, color: dark.ink },
  botBottom: { flexDirection: "row", alignItems: "center", gap: space.md },
  pnl: { fontFamily: family.semibold, fontSize: 15 },
  muted: { flexShrink: 1, fontFamily: family.regular, fontSize: 12, lineHeight: 17, color: dark.muted },
  down: { color: dark.red },
  depositNote: { padding: space.md, borderRadius: 16, backgroundColor: "rgba(123, 115, 240, 0.16)" },
  depositNoteText: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.ink },
});
