import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { protectPosition, type ProtectLeg } from "../lib/serverBots";
import { dark, family, space, touch } from "../theme";

type Props = {
  visible: boolean;
  title: string;
  legs: ProtectLeg[];
  marginUsd: number;
  allowTarget: boolean;
  onClose: () => void;
};

export function ProtectSheet({ visible, title, legs, marginUsd, allowTarget, onClose }: Props) {
  const [stop, setStop] = useState("10");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

  async function go() {
    const stopValue = Number(stop);
    if (!(stopValue > 0)) {
      setStatus({ text: "Enter a stop loss above 0.", failed: true });
      return;
    }
    setBusy(true);
    try {
      const text = await protectPosition(title, legs, marginUsd, stopValue, allowTarget && Number(target) > 0 ? Number(target) : undefined, (step) => setStatus({ text: step, failed: false }));
      setStatus({ text, failed: false });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.note}>The stop {allowTarget ? "and target " : ""}rest on Perpl, so they work even when the app is closed. Percentages are of your margin ($ {marginUsd.toFixed(2)}). A 10% stop on 2x closes after a 5% price move.</Text>
          <Text style={styles.label}>Stop loss %</Text>
          <TextInput value={stop} onChangeText={setStop} keyboardType="decimal-pad" style={styles.input} />
          {allowTarget && (
            <>
              <Text style={styles.label}>Target % (optional)</Text>
              <TextInput value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="e.g. 20" placeholderTextColor={dark.muted} style={styles.input} />
            </>
          )}
          <Pressable disabled={busy} onPress={() => void go()} style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.8 }]}>
            <Text style={styles.buttonLabel}>{busy ? "Working…" : "Set protection"}</Text>
          </Pressable>
          {status !== null && <Text style={[styles.status, status.failed && styles.failed]}>{status.text}</Text>}
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { padding: space.lg, gap: space.sm, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: dark.surface },
  title: { fontFamily: family.semibold, fontSize: 20, letterSpacing: -0.5, color: dark.ink },
  note: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.muted },
  label: { fontFamily: family.medium, fontSize: 12, color: dark.muted, marginTop: space.xs },
  input: { minHeight: touch, paddingHorizontal: space.md, borderRadius: 14, backgroundColor: dark.paper, fontFamily: family.semibold, fontSize: 16, color: dark.ink },
  button: { minHeight: touch + space.xs, borderRadius: 999, backgroundColor: dark.ink, alignItems: "center", justifyContent: "center", marginTop: space.sm },
  buttonLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.paper },
  status: { fontFamily: family.regular, fontSize: 12, lineHeight: 18, color: dark.muted },
  failed: { color: dark.red },
  close: { alignItems: "center", paddingVertical: space.sm },
  closeLabel: { fontFamily: family.medium, fontSize: 14, color: dark.muted },
});
