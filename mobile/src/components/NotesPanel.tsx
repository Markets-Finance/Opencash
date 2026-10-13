import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { loadVault, notesNamespace, saveVault, type TradingAccount } from "shared";
import { backendUrl } from "../lib/config";
import { dark, family, space, touch } from "../theme";

export function NotesPanel({ trader }: { trader: TradingAccount }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>({ text: "Unlocking…", failed: false });

  useEffect(() => {
    let live = true;
    loadVault(backendUrl, trader, notesNamespace)
      .then((saved) => {
        if (!live) return;
        setText(saved ?? "");
        setStatus({ text: saved === null ? "Nothing saved yet." : "Unlocked on this device.", failed: false });
      })
      .catch((error) => live && setStatus({ text: error instanceof Error ? error.message : String(error), failed: true }));
    return () => {
      live = false;
    };
  }, [trader]);

  async function save() {
    setBusy(true);
    setStatus({ text: "Locking…", failed: false });
    try {
      await saveVault(backendUrl, trader, notesNamespace, text);
      setStatus({ text: "Locked and saved. Only your passkey can open it.", failed: false });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.note}>Written here, locked with a key your passkey makes, then stored on our server as ciphertext. We cannot read it. Sign in with the same passkey on any device to open it.</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={20000}
        placeholder="Trade ideas, levels, reminders"
        placeholderTextColor={dark.muted}
        style={styles.input}
      />
      <Pressable disabled={busy} onPress={() => void save()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonLabel}>Lock and save</Text>
      </Pressable>
      {status !== null && <Text style={[styles.status, status.failed && styles.failed]}>{status.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: 18, backgroundColor: dark.surface, gap: space.sm },
  note: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.muted },
  input: { minHeight: 160, textAlignVertical: "top", padding: space.md, borderRadius: 14, backgroundColor: dark.paper, fontFamily: family.regular, fontSize: 15, color: dark.ink },
  button: { minHeight: touch, borderRadius: 999, backgroundColor: dark.ink, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.paper },
  pressed: { opacity: 0.8 },
  status: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  failed: { color: dark.red },
});
