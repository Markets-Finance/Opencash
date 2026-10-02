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
import type { Bin, BinSizingIssue, SizedBin, TradingAccount } from "shared";
import { AssetMark, LegStack } from "../components/AssetMark";
import { openBin, sizeBinFor, type EntryStep, type HoodData } from "../lib/hood";
import { family, space, track } from "../theme";

type BinDetailProps = {
  bin: Bin;
  data: HoodData;
  balance: number | null;
  trader: TradingAccount;
  onBack: () => void;
};

const stepLabels: Record<EntryStep, string> = {
  approve: "Approving USDG…",
  swap: "Swapping every leg…",
};

const presets = [10, 25, 50, 100];

export function BinDetail({ bin, data, balance, trader, onBack }: BinDetailProps) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sizing, setSizing] = useState(false);
  const [result, setResult] = useState<{ sized: SizedBin; issues: BinSizingIssue[] } | null>(null);

  const usdgAmount = Number(amount) || 0;

  useEffect(() => {
    if (usdgAmount <= 0) {
      setResult(null);
      return;
    }
    let live = true;
    setSizing(true);
    sizeBinFor(bin, usdgAmount, data.tokens)
      .then((next) => live && setResult(next))
      .catch(() => live && setResult(null))
      .finally(() => live && setSizing(false));
    return () => {
      live = false;
    };
  }, [bin, usdgAmount, data]);

  async function submit() {
    if (!result) return;
    setBusy(true);
    setFailed(false);
    try {
      await openBin(trader, result.sized, (step) => setStatus(stepLabels[step]));
      setStatus(`${bin.name} is open.`);
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const blocked =
    busy
      ? "Working…"
      : usdgAmount <= 0
      ? "Enter an amount"
      : sizing
        ? "Pricing…"
        : !result || result.sized.legs.length === 0
          ? "No leg can be filled at this size"
          : balance !== null && usdgAmount > balance
            ? "Insufficient balance"
            : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.heading}>{bin.name}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 160 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityRow}>
          <LegStack symbols={bin.legs.map((leg) => leg.symbol)} size={44} />
          <Text style={styles.thesis}>{bin.thesis}</Text>
        </View>

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
            />
          </View>
          <View style={styles.presets}>
            {presets.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => setAmount(String(preset))}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipLabel}>${preset}</Text>
              </Pressable>
            ))}
          </View>
          {balance !== null ? (
            <Text style={styles.balance}>
              USDG balance ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          ) : null}
        </View>

        {(result?.sized.legs.length ?? 0) > 0 && (
          <View style={styles.legsCard}>
            <Text style={styles.fieldLabel}>Legs</Text>
            {(result?.sized.legs ?? []).map((leg) => (
              <View key={leg.leg.symbol} style={styles.legRow}>
                <AssetMark symbol={leg.leg.symbol} size={34} />
                <View style={styles.legIdentity}>
                  <Text style={styles.legSymbol}>{leg.leg.symbol}</Text>
                  <Text style={styles.legStat}>
                    ${leg.usdgIn.toFixed(2)} · ≈ {leg.quote.tokensOut.toFixed(4)}
                  </Text>
                </View>
                <Text style={styles.legPrice}>${leg.quote.price.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {(result?.issues ?? []).map((issue) => (
          <View key={`${issue.symbol}-${issue.reason}`} style={styles.warnCard}>
            <Text style={styles.warnText}>{issue.detail}</Text>
          </View>
        ))}

        {status !== null ? (
          <Text style={[styles.status, failed && styles.statusFailed]}>{status}</Text>
        ) : null}

        <Text style={styles.footnote}>
          All legs swap together or none do. Price and slippage are quoted live
          from Uniswap on Robinhood Chain.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.totals}>
          <Text style={styles.totalLabel}>Total USDG</Text>
          <Text style={styles.totalValue}>${(result?.sized.usdgIn ?? 0).toFixed(2)}</Text>
        </View>
        <Pressable
          disabled={blocked !== null}
          onPress={() => void submit()}
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
              {blocked ?? `Open ${bin.name}`}
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
  thesis: {
    flex: 1,
    fontFamily: family.regular,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#77777a",
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
  legsCard: {
    padding: space.lg,
    borderRadius: 18,
    backgroundColor: "#fafafa",
    gap: space.md,
  },
  legRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  legIdentity: { flex: 1, minWidth: 0 },
  legSymbol: { fontFamily: family.semibold, fontSize: 14, color: "#131315" },
  legStat: { fontFamily: family.regular, fontSize: 11, color: "#858589" },
  legPrice: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  warnCard: { padding: space.md, borderRadius: 14, backgroundColor: "#fdeceb" },
  warnText: {
    fontFamily: family.regular,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: "#a5382a",
  },
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
    gap: space.sm,
  },
  totals: { flexDirection: "row", alignItems: "baseline" },
  totalLabel: { flex: 1, fontFamily: family.regular, fontSize: 13, color: "#77777a" },
  totalValue: {
    fontFamily: family.semibold,
    fontSize: 20,
    letterSpacing: track(20, -0.03),
    color: "#0c0c0c",
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
