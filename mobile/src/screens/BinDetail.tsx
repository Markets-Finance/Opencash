import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bin, BinSizingIssue, SizedBin, TradingAccount } from "shared";
import { DashedRule } from "../components/DashedRule";
import { Diamond } from "../components/Diamond";
import { SectionLabel } from "../components/SectionLabel";
import { openBin, sizeBinFor, type EntryStep, type HoodData } from "../lib/hood";
import { color, family, radius, space, track } from "../theme";

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.section,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>← Bins</Text>
      </Pressable>

      <SectionLabel>{bin.name.toUpperCase()}</SectionLabel>
      <Text style={styles.thesis}>{bin.thesis}</Text>

      <DashedRule />

      <Text style={styles.fieldLabel}>Amount</Text>
      <View style={styles.amountRow}>
        <Text style={styles.currency}>$</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#b6b4b0"
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

      <DashedRule />

      <Text style={styles.fieldLabel}>Legs</Text>
      {(result?.sized.legs ?? []).map((leg) => (
        <View key={leg.leg.symbol} style={styles.legCard}>
          <View style={styles.legHead}>
            <Diamond size={5} fill={color.purple} />
            <Text style={styles.legSymbol}>{leg.leg.symbol}</Text>
            <View style={styles.spacer} />
            <Text style={styles.legPrice}>${leg.quote.price.toFixed(2)}</Text>
          </View>
          <View style={styles.legStats}>
            <Text style={styles.legStat}>usdg ${leg.usdgIn.toFixed(2)}</Text>
            <Text style={styles.legStat}>
              ≈ {leg.quote.tokensOut.toFixed(4)} shares
            </Text>
          </View>
        </View>
      ))}

      {(result?.issues ?? []).map((issue) => (
        <Text key={`${issue.symbol}-${issue.reason}`} style={styles.issue}>
          {issue.detail}
        </Text>
      ))}

      <DashedRule />

      <View style={styles.totals}>
        <Text style={styles.totalLabel}>Total USDG</Text>
        <Text style={styles.totalValue}>
          ${(result?.sized.usdgIn ?? 0).toFixed(2)}
        </Text>
      </View>

      <Pressable
        disabled={blocked !== null}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.cta,
          blocked !== null && styles.ctaDisabled,
          pressed && styles.ctaPressed,
        ]}
      >
        <Text
          style={[styles.ctaLabel, blocked !== null && styles.ctaLabelDisabled]}
        >
          {blocked ?? `Open ${bin.name}`}
        </Text>
      </Pressable>

      {status !== null ? (
        <Text style={[styles.status, failed && styles.statusFailed]}>
          {status}
        </Text>
      ) : null}

      <Text style={styles.footnote}>
        All legs swap together or none do. Price and slippage are quoted live
        from Uniswap on Robinhood Chain.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { paddingHorizontal: space.xl, gap: space.lg },
  back: {
    fontFamily: family.regular,
    fontSize: 13,
    color: color.purpleLabel,
    marginBottom: space.md,
  },
  thesis: {
    fontFamily: family.light,
    fontSize: 15,
    lineHeight: 15 * 1.6,
    color: "#6f6d6a",
  },
  fieldLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#8a8884",
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  currency: {
    fontFamily: family.light,
    fontSize: 34,
    color: color.ink,
  },
  amountInput: {
    flex: 1,
    fontFamily: family.light,
    fontSize: 44,
    letterSpacing: track(44, -0.04),
    color: color.ink,
    padding: 0,
  },
  presets: { flexDirection: "row", gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  chipPressed: { borderColor: color.purple },
  chipLabel: { fontFamily: family.regular, fontSize: 13, color: color.ink },
  balance: { fontFamily: family.light, fontSize: 12, color: "#8a8884" },
  legCard: {
    borderWidth: 1,
    borderColor: color.line,
    padding: space.md,
    gap: space.sm,
  },
  legHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  legSymbol: { fontFamily: family.medium, fontSize: 14, color: color.ink },
  spacer: { flex: 1 },
  legPrice: { fontFamily: family.regular, fontSize: 13, color: color.purpleLabel },
  legStats: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  legStat: { fontFamily: family.light, fontSize: 12, color: "#6f6d6a" },
  issue: { fontFamily: family.light, fontSize: 12, color: "#a5382a" },
  totals: { flexDirection: "row", alignItems: "baseline" },
  totalLabel: { fontFamily: family.light, fontSize: 13, color: "#6f6d6a", flex: 1 },
  totalValue: {
    fontFamily: family.regular,
    fontSize: 20,
    letterSpacing: track(20, -0.03),
    color: color.ink,
  },
  cta: {
    backgroundColor: color.purple,
    borderRadius: radius,
    paddingVertical: space.lg,
    alignItems: "center",
  },
  ctaDisabled: { backgroundColor: "#e6e4e0" },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { fontFamily: family.medium, fontSize: 15, color: color.paper },
  ctaLabelDisabled: { color: "#8a8884" },
  status: {
    fontFamily: family.light,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: color.purpleLabel,
  },
  statusFailed: { color: "#a5382a" },
  footnote: {
    fontFamily: family.light,
    fontSize: 11,
    lineHeight: 11 * 1.6,
    color: "#8a8884",
  },
});
