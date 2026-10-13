import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { legacyNotesNamespace, loadVault, notesNamespace, saveVault, vaultExists, type NamespaceSession, type TradingAccount } from "shared";
import { backendUrl } from "../lib/config";
import { openNamespace } from "../lib/mera";
import { dark, family, space, touch } from "../theme";

export function NotesPanel({ trader }: { trader: TradingAccount }) {
  const [text, setText] = useState("");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);
  const session = useRef<NamespaceSession | null>(null);

  async function ensureSession(): Promise<NamespaceSession> {
    session.current ??= await openNamespace(notesNamespace);
    return session.current;
  }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const saved = await vaultExists(backendUrl, trader.address, notesNamespace);
        const old = !saved && (await vaultExists(backendUrl, trader.address, legacyNotesNamespace));
        if (!live) return;
        setLocked(saved || old);
        setStatus({ text: saved ? "Your notes are locked. Unlock with your passkey to read them." : old ? "Older notes found. Unlock to read them, then save to upgrade the lock." : "Nothing saved yet. Saving asks for your passkey once.", failed: false });
      } catch (error) {
        if (live) setStatus({ text: error instanceof Error ? error.message : String(error), failed: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [trader]);

  async function unlock() {
    setBusy(true);
    setStatus({ text: "Waiting for your passkey…", failed: false });
    try {
      const saved = await vaultExists(backendUrl, trader.address, notesNamespace);
      setText((saved ? await loadVault(backendUrl, trader, notesNamespace, await ensureSession()) : await loadVault(backendUrl, trader, legacyNotesNamespace)) ?? "");
      setLocked(false);
      setStatus({ text: "Unlocked on this device.", failed: false });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setStatus({ text: "Waiting for your passkey…", failed: false });
    try {
      await saveVault(backendUrl, trader, notesNamespace, text, await ensureSession());
      setLocked(false);
      setStatus({ text: "Locked and saved. Only your passkey can open it.", failed: false });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.note}>Written here, locked with a key your passkey makes just for notes, then stored on our server as ciphertext. We cannot read it. Sign in with the same passkey on any device to open it.</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!locked}
        multiline
        maxLength={20000}
        placeholder="Trade ideas, levels, reminders"
        placeholderTextColor={dark.muted}
        style={[styles.input, locked && { opacity: 0.4 }]}
      />
      {locked && (
        <Pressable disabled={busy} onPress={() => void unlock()} style={({ pressed }) => [styles.button, styles.quiet, pressed && styles.pressed]}>
          <Text style={styles.quietLabel}>Unlock with passkey</Text>
        </Pressable>
      )}
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
  quiet: { backgroundColor: "transparent", borderWidth: 1, borderColor: dark.muted },
  quietLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.ink },
  pressed: { opacity: 0.8 },
  status: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  failed: { color: dark.red },
});
