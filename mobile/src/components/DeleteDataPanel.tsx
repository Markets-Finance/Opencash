import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteAccountMessage, type TradingAccount } from "shared";
import { backendUrl } from "../lib/config";
import { clearImport } from "../lib/mera";
import { dark, family, space, touch } from "../theme";

export function DeleteDataPanel({ trader, onDeleted }: { trader: TradingAccount; onDeleted: () => void }) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

  async function remove() {
    setBusy(true);
    setStatus({ text: "Deleting your data on our server…", failed: false });
    try {
      const issuedAt = Date.now();
      const signature = await trader.account.signMessage({ message: deleteAccountMessage(trader.address, issuedAt) });
      const response = await fetch(`${backendUrl}/account/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: trader.address, issuedAt, signature }),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server ${response.status}`);
      setStatus({ text: "Wiping this device…", failed: false });
      await clearImport();
      const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("opencash."));
      await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
      onDeleted();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), failed: true });
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.note}>This removes your bots, saved Perpl trade key, boards, snapshots, shared strategies, notes and referral record from our server, then wipes this device and signs you out. It does not touch your wallet, your Perpl account or any funds. Close open positions and stop bots first.</Text>
      <Text style={styles.note}>Type DELETE to confirm.</Text>
      <TextInput value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={dark.muted} style={styles.input} />
      <Pressable disabled={busy || word.trim() !== "DELETE"} onPress={() => void remove()} style={({ pressed }) => [styles.button, (busy || word.trim() !== "DELETE") && styles.off, pressed && styles.pressed]}>
        <Text style={styles.buttonLabel}>{busy ? "Working…" : "Delete my data"}</Text>
      </Pressable>
      {status !== null && <Text style={[styles.status, status.failed && styles.failed]}>{status.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: 18, backgroundColor: dark.surface, gap: space.sm },
  note: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.muted },
  input: { minHeight: touch, paddingHorizontal: space.md, borderRadius: 14, backgroundColor: dark.paper, fontFamily: family.semibold, fontSize: 16, color: dark.ink },
  button: { minHeight: touch, borderRadius: 999, backgroundColor: "#ec6f5c", alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  buttonLabel: { fontFamily: family.semibold, fontSize: 15, color: "#14181a" },
  status: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  failed: { color: dark.red },
});
