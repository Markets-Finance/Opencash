import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { turnOnServerRunning } from "../lib/serverAccess";
import { dark, family, space } from "../theme";

export function ServerRunning({ hasKey, onChanged }: { hasKey: boolean; onChanged: () => void }) {
  const [step, setStep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function turnOn() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await turnOnServerRunning(setStep);
      setStep("Server running is on.");
    } catch (error) {
      setFailed(true);
      setStep(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        {hasKey ? "Server running is on. Your bots keep working when the app is closed." : "Turn on server running so your bots keep working when the app is closed. It takes one passkey approval."}
      </Text>
      {!hasKey && (
        <Pressable disabled={busy} onPress={() => void turnOn()} accessibilityRole="button" style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>
          <Text style={styles.label}>{busy ? "Working…" : "Turn on server running"}</Text>
        </Pressable>
      )}
      {step !== null && <Text style={[styles.text, failed && styles.failed]}>{step}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  text: { fontFamily: family.regular, fontSize: 13, lineHeight: 19, color: dark.muted },
  failed: { color: dark.red },
  button: { height: 52, borderRadius: 26, backgroundColor: dark.ink, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: family.semibold, fontSize: 15, color: dark.paper },
  pressed: { opacity: 0.8 },
});
