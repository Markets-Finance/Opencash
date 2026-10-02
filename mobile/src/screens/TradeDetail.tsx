import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HoodPool, HoodQuote, HoodSellQuote, TradingAccount } from "shared";
import { AssetMark } from "../components/AssetMark";
import {
  buyToken,
  checkTradable,
  loadTokenHolding,
  quoteSell,
  quoteTrade,
  sellToken,
  type EntryStep,
  type TokenHolding,
  type TradeAsset,
} from "../lib/hood";
import { family, space, track } from "../theme";

type TradeDetailProps = {
  asset: TradeAsset;
  balance: number | null;
  trader: TradingAccount;
  onBack: () => void;
};

const stepLabels: Record<EntryStep, string> = {
  approve: "Approving…",
  swap: "Swapping…",
};

type Mode = "buy" | "sell";

const buyPresets = [10, 25, 50, 100];
const sellPresetFractions = [0.25, 0.5, 0.75, 1];

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function TradeDetail({ asset, balance, trader, onBack }: TradeDetailProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("buy");
  const [pool, setPool] = useState<HoodPool | null | "checking">("checking");
  const [holding, setHolding] = useState<TokenHolding | null>(null);
  const [amount, setAmount] = useState("");
  const [sellAll, setSellAll] = useState(false);
  const [sizing, setSizing] = useState(false);
  const [buyQuote, setBuyQuote] = useState<HoodQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<HoodSellQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const usdgAmount = Number(amount) || 0;
  const shareAmount = sellAll ? (holding?.shares ?? 0) : Number(amount) || 0;

  useEffect(() => {
    let live = true;
    checkTradable(asset.token)
      .then((found) => live && setPool(found))
      .catch(() => live && setPool(null));
    loadTokenHolding(trader.address, asset.token)
      .then((next) => live && setHolding(next))
      .catch(() => live && setHolding(null));
    return () => {
      live = false;
    };
  }, [asset.token, trader.address]);

  useEffect(() => {
    setAmount("");
    setSellAll(false);
    setBuyQuote(null);
    setSellQuote(null);
  }, [mode]);

  useEffect(() => {
    if (mode !== "buy" || usdgAmount <= 0 || pool === "checking" || pool === null) {
      setBuyQuote(null);
      return;
    }
    let live = true;
    setSizing(true);
    quoteTrade(asset.token, usdgAmount)
      .then((next) => live && setBuyQuote(next))
      .catch(() => live && setBuyQuote(null))
      .finally(() => live && setSizing(false));
    return () => {
      live = false;
    };
  }, [mode, asset.token, usdgAmount, pool]);

  useEffect(() => {
    if (mode !== "sell" || shareAmount <= 0 || pool === "checking" || pool === null) {
      setSellQuote(null);
      return;
    }
    let live = true;
    setSizing(true);
    quoteSell(asset.token, shareAmount)
      .then((next) => live && setSellQuote(next))
      .catch(() => live && setSellQuote(null))
      .finally(() => live && setSizing(false));
    return () => {
      live = false;
    };
  }, [mode, asset.token, shareAmount, pool]);

  async function submitBuy() {
    if (!buyQuote) return;
    setBusy(true);
    setFailed(false);
    try {
      setStatus("Waiting for your passkey…");
      await buyToken(trader, asset.token, usdgAmount, buyQuote, (step) =>
        setStatus(stepLabels[step]),
      );
      setStatus(`Bought ${asset.token.symbol}.`);
      setAmount("");
      const next = await loadTokenHolding(trader.address, asset.token);
      setHolding(next);
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitSell() {
    if (!sellQuote || !holding) return;
    setBusy(true);
    setFailed(false);
    try {
      setStatus("Waiting for your passkey…");
      const amountInRaw = sellAll
        ? holding.raw
        : holding.shares > 0
          ? (holding.raw * BigInt(Math.round((shareAmount / holding.shares) * 1_000_000))) /
            1_000_000n
          : 0n;
      await sellToken(trader, asset.token, amountInRaw, sellQuote, (step) =>
        setStatus(stepLabels[step]),
      );
      setStatus(`Sold ${asset.token.symbol}.`);
      setAmount("");
      setSellAll(false);
      const next = await loadTokenHolding(trader.address, asset.token);
      setHolding(next);
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const quote = mode === "buy" ? buyQuote : null;
  const premiumBps =
    quote && asset.price ? Math.round(((quote.price - asset.price) / asset.price) * 10000) : null;

  const buyBlocked =
    busy
      ? "Working…"
      : pool === "checking"
        ? "Checking market…"
        : pool === null
          ? "No onchain market yet"
          : asset.halted
            ? "Trading halted"
            : usdgAmount <= 0
              ? "Enter an amount"
              : sizing
                ? "Pricing…"
                : !buyQuote
                  ? "No quote available"
                  : balance !== null && usdgAmount > balance
                    ? "Insufficient balance"
                    : null;

  const sellBlocked =
    busy
      ? "Working…"
      : pool === "checking"
        ? "Checking market…"
        : pool === null
          ? "No onchain market yet"
          : asset.halted
            ? "Trading halted"
            : !holding || holding.shares <= 0
              ? "Nothing to sell"
              : shareAmount <= 0
                ? "Enter an amount"
                : sizing
                  ? "Pricing…"
                  : !sellQuote
                    ? "No quote available"
                    : shareAmount > holding.shares
                      ? "More than you hold"
                      : null;

  const blocked = mode === "buy" ? buyBlocked : sellBlocked;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.heading}>{asset.token.symbol}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 160 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.identityRow}>
          <AssetMark symbol={asset.token.symbol} size={48} />
          <View style={styles.identityText}>
            <Text style={styles.name}>{asset.token.name}</Text>
            {asset.price !== null && (
              <Text style={styles.reference}>Reference {usd(asset.price)}</Text>
            )}
          </View>
        </View>

        {holding !== null && holding.shares > 0 && (
          <Text style={styles.holding}>
            You hold {holding.shares.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
            {asset.token.symbol}
          </Text>
        )}

        <View style={styles.modeRow}>
          {(["buy", "sell"] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => setMode(key)}
              style={[styles.modeTab, mode === key && styles.modeTabActive]}
            >
              <Text style={[styles.modeLabel, mode === key && styles.modeLabelActive]}>
                {key === "buy" ? "Buy" : "Sell"}
              </Text>
            </Pressable>
          ))}
        </View>

        {pool === null && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              No Uniswap pool was found for this token on Robinhood Chain — it
              isn't tradable here yet, even though it has a reference price.
            </Text>
          </View>
        )}
        {asset.halted && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>Trading is currently halted for this token.</Text>
          </View>
        )}

        {mode === "buy" ? (
          <View style={styles.amountCard}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#b3b3b6"
                style={styles.amountInput}
                editable={pool !== "checking" && pool !== null}
              />
            </View>
            <View style={styles.presets}>
              {buyPresets.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setAmount(String(preset))}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.chipLabel}>${preset}</Text>
                </Pressable>
              ))}
            </View>
            {balance !== null && (
              <Text style={styles.balance}>USDG balance {usd(balance)}</Text>
            )}
          </View>
        ) : (
          <View style={styles.amountCard}>
            <Text style={styles.fieldLabel}>Shares to sell</Text>
            <View style={styles.amountRow}>
              <TextInput
                value={sellAll ? holding?.shares.toString() ?? "" : amount}
                onChangeText={(next) => {
                  setSellAll(false);
                  setAmount(next);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#b3b3b6"
                style={styles.amountInput}
                editable={pool !== "checking" && pool !== null && !sellAll}
              />
              <Text style={styles.currencySuffix}>{asset.token.symbol}</Text>
            </View>
            <View style={styles.presets}>
              {sellPresetFractions.map((fraction) => (
                <Pressable
                  key={fraction}
                  onPress={() => {
                    if (fraction === 1) {
                      setSellAll(true);
                      setAmount("");
                    } else {
                      setSellAll(false);
                      setAmount(((holding?.shares ?? 0) * fraction).toString());
                    }
                  }}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.chipLabel}>
                    {fraction === 1 ? "Max" : `${fraction * 100}%`}
                  </Text>
                </Pressable>
              ))}
            </View>
            {holding !== null && (
              <Text style={styles.balance}>
                Holding {holding.shares.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                {asset.token.symbol}
              </Text>
            )}
          </View>
        )}

        {mode === "buy" && buyQuote && (
          <View style={styles.quoteCard}>
            <View style={styles.quoteRow}>
              <Text style={styles.fieldLabel}>You receive</Text>
              <Text style={styles.quoteValue}>
                ≈ {buyQuote.tokensOut.toFixed(6)} {asset.token.symbol}
              </Text>
            </View>
            <Text style={styles.quoteStat}>Execution price {usd(buyQuote.price)}</Text>
            {premiumBps !== null && Math.abs(premiumBps) >= 150 && (
              <Text style={styles.warnText}>
                This quote is {(premiumBps / 100).toFixed(1)}% away from the
                reference price — the pool is thin, expect real slippage.
              </Text>
            )}
          </View>
        )}

        {mode === "sell" && sellQuote && (
          <View style={styles.quoteCard}>
            <View style={styles.quoteRow}>
              <Text style={styles.fieldLabel}>You receive</Text>
              <Text style={styles.quoteValue}>≈ {usd(sellQuote.usdgOut)}</Text>
            </View>
            <Text style={styles.quoteStat}>Execution price {usd(sellQuote.price)}</Text>
          </View>
        )}

        {status !== null && (
          <Text style={[styles.status, failed && styles.statusFailed]}>{status}</Text>
        )}

        <Text style={styles.footnote}>
          Priced live from Uniswap on Robinhood Chain. Slippage tolerance 1%.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          disabled={blocked !== null}
          onPress={() => void (mode === "buy" ? submitBuy() : submitSell())}
          style={({ pressed }) => [
            styles.primaryButton,
            blocked !== null && styles.primaryButtonDisabled,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={[
                styles.primaryLabel,
                blocked !== null && styles.primaryLabelDisabled,
              ]}
            >
              {blocked ?? `${mode === "buy" ? "Buy" : "Sell"} ${asset.token.symbol}`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ededed" },
  header: {
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontFamily: family.semibold,
    fontSize: 19,
    letterSpacing: track(19, -0.03),
    color: "#0c0c0c",
  },
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#f8f8f8",
    alignItems: "center",
    justifyContent: "center",
  },
  back: { fontFamily: family.regular, fontSize: 22, color: "#55555a" },
  content: { padding: space.lg, gap: space.lg },
  identityRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  identityText: { flex: 1, minWidth: 0 },
  name: { fontFamily: family.medium, fontSize: 15, color: "#131315" },
  reference: { fontFamily: family.regular, fontSize: 12, color: "#858589", marginTop: 2 },
  holding: { fontFamily: family.regular, fontSize: 12, color: "#858589" },
  modeRow: { flexDirection: "row", gap: space.sm },
  modeTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  modeTabActive: { backgroundColor: "#090909" },
  modeLabel: { fontFamily: family.medium, fontSize: 14, color: "#131315" },
  modeLabelActive: { color: "#fff" },
  currencySuffix: { fontFamily: family.medium, fontSize: 16, color: "#858589" },
  warnCard: {
    padding: space.md,
    borderRadius: 14,
    backgroundColor: "#fdeceb",
  },
  warnText: {
    fontFamily: family.regular,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: "#a5382a",
  },
  amountCard: {
    padding: space.lg,
    borderRadius: 18,
    backgroundColor: "#fafafa",
    gap: space.sm,
  },
  fieldLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  currency: { fontFamily: family.light, fontSize: 32, color: "#131315" },
  amountInput: {
    flex: 1,
    fontFamily: family.light,
    fontSize: 40,
    letterSpacing: track(40, -0.04),
    color: "#131315",
    padding: 0,
  },
  presets: { flexDirection: "row", gap: space.sm },
  chip: {
    borderRadius: 999,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: "#f0f0f0",
  },
  chipPressed: { backgroundColor: "#e4e4e4" },
  chipLabel: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  balance: { fontFamily: family.regular, fontSize: 12, color: "#858589" },
  quoteCard: {
    padding: space.lg,
    borderRadius: 18,
    backgroundColor: "#fafafa",
    gap: space.xs,
  },
  quoteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  quoteValue: { fontFamily: family.medium, fontSize: 15, color: "#131315" },
  quoteStat: { fontFamily: family.regular, fontSize: 12, color: "#858589" },
  status: { fontFamily: family.regular, fontSize: 13, color: "#4e4e51" },
  statusFailed: { color: "#a5382a" },
  footnote: {
    fontFamily: family.regular,
    fontSize: 11,
    lineHeight: 11 * 1.6,
    color: "#9a9a9d",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: "rgba(237,237,237,0.96)",
  },
  primaryButton: {
    minHeight: 64,
    borderRadius: 33,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: { backgroundColor: "#dcdcdc" },
  primaryButtonPressed: { opacity: 0.85 },
  primaryLabel: { fontFamily: family.medium, fontSize: 16, color: "#fff" },
  primaryLabelDisabled: { color: "#8a8a8d" },
});
