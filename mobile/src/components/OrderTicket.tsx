import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { estimateExecution, slippageWarnBps, type MarketSnapshot, type perpl, type TradingAccount } from "shared";
import { toolbox } from "../lib/bots";
import { openBin, singleLegBin, sizeBinFor, type MarketData } from "../lib/perpl";
import { dark, family, space, touch, track } from "../theme";
import { CardTitle, SelectPill, Switcher, Tag, ToneCard, tone } from "./ui";

type Direction = "long" | "short";
type Status = { text: string; failed: boolean } | null;

const leverageChoices = [1, 2, 3, 5];

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function CostRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.costRow}>
      <Text style={styles.costLabel}>{label}</Text>
      <Text style={[styles.costValue, warn === true && styles.costWarn]}>{value}</Text>
    </View>
  );
}

type OrderTicketProps = {
  trader: TradingAccount;
  data: MarketData;
  symbol: string;
  initialDirection?: Direction;
  onOpened: () => void;
};

export function OrderTicket({ trader, data, symbol, initialDirection, onOpened }: OrderTicketProps) {
  const [direction, setDirection] = useState<Direction>(initialDirection ?? "long");
  const [leverage, setLeverage] = useState(3);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [book, setBook] = useState<perpl.Book | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let live = true;
    setBook(null);
    setSnapshot(null);
    toolbox.getBook(symbol).then((next) => live && setBook(next)).catch(() => {});
    toolbox.getSnapshot(symbol).then(({ snapshot: next }) => live && setSnapshot(next)).catch(() => {});
    return () => {
      live = false;
    };
  }, [symbol]);

  const market = data.markets.get(symbol) ?? null;
  const cap = data.maxLeverage.get(symbol) ?? leverage;
  const margin = Number(amount) || 0;

  const preview = useMemo(() => {
    if (!market || margin <= 0) return null;
    return sizeBinFor(singleLegBin(symbol, direction, Math.min(leverage, cap)), margin, data);
  }, [data, market, symbol, direction, leverage, cap, margin]);

  const leg = preview?.sized.legs[0] ?? null;

  const estimate = useMemo(() => {
    if (!book || !snapshot || !leg) return null;
    return estimateExecution({
      book,
      side: direction === "long" ? "buy" : "sell",
      notionalUsd: leg.notional,
      takerFeeBps: snapshot.takerFeeBps,
      fundingAprPct: snapshot.funding.nowAprPct,
    });
  }, [book, snapshot, leg, direction]);

  const risky = estimate !== null && (estimate.slippageBps === null || estimate.slippageBps > slippageWarnBps);

  useEffect(() => setConfirmed(false), [symbol, direction, amount, leverage]);

  async function submit() {
    if (!preview || !leg) return;
    if (risky && !confirmed) {
      setConfirmed(true);
      return;
    }
    setBusy(true);
    setStatus({ text: "Sending…", failed: false });
    try {
      await openBin(trader, preview.sized, data, (step) =>
        setStatus({ text: step === "orders" ? "Opening position…" : "Funding account…", failed: false }),
      );
      setStatus({ text: `${direction === "long" ? "Long" : "Short"} ${symbol} is open.`, failed: false });
      setAmount("");
      onOpened();
    } catch (error) {
      setStatus({ text: errorText(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  const blocked = busy
    ? "Working…"
    : margin <= 0
      ? "Enter an amount"
      : !leg
        ? (preview?.issues[0]?.detail ?? "Size is below one lot")
        : null;

  return (
    <ToneCard>
      <CardTitle>Open a position</CardTitle>
      <Switcher
        items={[
          { key: "long", label: "Long", dot: dark.green },
          { key: "short", label: "Short", dot: dark.red },
        ]}
        value={direction}
        onChange={setDirection}
      />
      <Text style={styles.fieldLabel}>MARGIN (AUSD)</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={dark.muted}
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>LEVERAGE</Text>
      <View style={styles.row}>
        {leverageChoices.filter((value) => value <= cap).map((value) => (
          <SelectPill key={value} label={`${value}x`} active={leverage === value} onPress={() => setLeverage(value)} />
        ))}
      </View>
      {estimate !== null && (
        <View style={styles.cost}>
          <CostRow label="Slippage" value={estimate.slippageBps === null ? "Beyond the book" : `${estimate.slippageBps.toFixed(1)} bps · ${usd(estimate.slippageUsd ?? 0)}`} warn={risky} />
          <CostRow label="Spread" value={`${estimate.spreadBps.toFixed(1)} bps`} />
          <CostRow label="Taker fee" value={usd(estimate.feeUsd)} />
          <CostRow label="Funding a day" value={`${estimate.fundingDailyUsd >= 0 ? "pay" : "earn"} ${usd(Math.abs(estimate.fundingDailyUsd))}`} />
          {risky && (
            <Text style={styles.warn}>
              Thin book for this size. Up to {usd(estimate.maxSizeUsd)} fills within {slippageWarnBps} bps.
            </Text>
          )}
        </View>
      )}
      {leg !== null && (
        <View style={styles.tags}>
          <Tag label={`${leg.lots} ${symbol}`} />
          <Tag label={`${usd(leg.notional)} position`} />
          <Tag label={`${leg.leverage}x`} />
        </View>
      )}
      <Pressable
        disabled={blocked !== null}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: direction === "long" ? dark.green : tone.coral },
          blocked !== null && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.primaryLabel}>
          {blocked ?? (risky && confirmed ? "Tap again to accept slippage" : `${direction === "long" ? "Long" : "Short"} ${symbol}`)}
        </Text>
      </Pressable>
      {status !== null && <Text style={status.failed ? styles.error : styles.muted}>{status.text}</Text>}
    </ToneCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  cost: { gap: space.xs },
  costRow: { flexDirection: "row", justifyContent: "space-between" },
  costLabel: { fontFamily: family.regular, fontSize: 13, color: dark.muted },
  costValue: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
  costWarn: { color: dark.red },
  warn: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.red },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  fieldLabel: { fontFamily: family.medium, fontSize: 11, letterSpacing: track(11, 0.12), color: dark.muted },
  input: { fontFamily: family.light, fontSize: 40, letterSpacing: track(40, -0.04), color: dark.ink, padding: 0 },
  primary: { minHeight: touch + space.md, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontFamily: family.semibold, fontSize: 15, color: tone.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  muted: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  error: { fontFamily: family.regular, fontSize: 13, color: dark.red },
});
