import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TradingAccount } from "shared";
import { depositToPerpl, loadAccount, loadCollateralBalance, withdrawToWallet } from "../lib/perpl";
import { dark, family, space, touch } from "../theme";

type Way = "in" | "out";

function amountText(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function MovePanel({ trader }: { trader: TradingAccount }) {
  const [way, setWay] = useState<Way>("in");
  const [wallet, setWallet] = useState<number | null>(null);
  const [perpl, setPerpl] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const [inWallet, account] = await Promise.all([loadCollateralBalance(trader.address).catch(() => null), loadAccount(trader.address).catch(() => null)]);
    setWallet(inWallet);
    setPerpl(account === null ? 0 : account.balance);
  }, [trader.address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const available = way === "in" ? wallet : perpl;

  async function move() {
    const value = Number(amount);
    if (!(value > 0)) {
      setStatus({ text: "Enter an amount.", failed: true });
      return;
    }
    setBusy(true);
    setStatus({ text: "Working…", failed: false });
    try {
      if (way === "in") {
        await depositToPerpl(trader, value, (step) => setStatus({ text: step === "approve" ? "Approving AUSD…" : "Depositing into Perpl…", failed: false }));
        setStatus({ text: `Moved ${amountText(value)} AUSD into Perpl.`, failed: false });
      } else {
        await withdrawToWallet(trader, value);
        setStatus({ text: `Moved ${amountText(value)} AUSD to your wallet.`, failed: false });
      }
      setAmount("");
      await refresh();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.note}>Your wallet holds AUSD. Your Perpl account holds the AUSD you trade with. Bots and live trades use the Perpl side. Opening a trade also tops up Perpl from your wallet by what is missing.</Text>
      <View style={styles.ways}>
        {(["in", "out"] as const).map((key) => (
          <Pressable key={key} onPress={() => setWay(key)} style={[styles.way, way === key && styles.wayOn]}>
            <Text style={[styles.wayLabel, way === key && styles.wayLabelOn]}>{key === "in" ? "Wallet → Perpl" : "Perpl → Wallet"}</Text>
            <Text style={[styles.wayValue, way === key && styles.wayLabelOn]}>{(key === "in" ? wallet : perpl) === null ? "…" : amountText((key === "in" ? wallet : perpl)!)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount in AUSD" placeholderTextColor={dark.muted} style={styles.input} />
        <Pressable onPress={() => available !== null && setAmount(String(Math.floor(available * 1e6) / 1e6))} style={styles.max}>
          <Text style={styles.maxLabel}>Max</Text>
        </Pressable>
      </View>
      <Pressable disabled={busy} onPress={() => void move()} style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>
        <Text style={styles.buttonLabel}>{busy ? "Working…" : "Move"}</Text>
      </Pressable>
      {status !== null && <Text style={[styles.status, status.failed && styles.failed]}>{status.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: 18, backgroundColor: dark.surface, gap: space.sm },
  note: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.muted },
  ways: { gap: space.sm },
  way: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: space.md, borderRadius: 14, backgroundColor: dark.paper },
  wayOn: { backgroundColor: "#b4f58c" },
  wayLabel: { fontFamily: family.medium, fontSize: 15, color: dark.ink },
  wayValue: { fontFamily: family.semibold, fontSize: 15, color: dark.ink },
  wayLabelOn: { color: "#14181a" },
  row: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  input: { flex: 1, minHeight: touch, paddingHorizontal: space.md, borderRadius: 14, backgroundColor: dark.paper, fontFamily: family.regular, fontSize: 16, color: dark.ink },
  max: { minHeight: touch, paddingHorizontal: space.lg, borderRadius: 999, backgroundColor: dark.paper, alignItems: "center", justifyContent: "center" },
  maxLabel: { fontFamily: family.medium, fontSize: 14, color: dark.ink },
  button: { minHeight: touch, borderRadius: 999, backgroundColor: dark.ink, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.paper },
  pressed: { opacity: 0.8 },
  status: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  failed: { color: dark.red },
});
