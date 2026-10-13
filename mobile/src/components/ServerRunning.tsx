import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { turnOffServerRunning, turnOnServerRunning } from "../lib/serverAccess";
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
      setStep("Autonomous trading is on.");
    } catch (error) {
      setFailed(true);
      setStep(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function turnOff() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setStep("Pausing every bot and removing the trade key…");
    try {
      await turnOffServerRunning();
      setStep("Autonomous trading is off. Open positions stay open.");
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
        {hasKey ? "Autonomous trading is on. Your bots keep working when the app is closed." : "Start autonomous trading so your bots keep working when the app is closed. It takes one passkey approval."}
      </Text>
      {!hasKey && (
        <Pressable disabled={busy} onPress={() => void turnOn()} accessibilityRole="button" style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>
          <Text style={styles.label}>{busy ? "Working…" : "Start autonomous trading"}</Text>
        </Pressable>
      )}
      {hasKey && (
        <Pressable disabled={busy} onPress={() => void turnOff()} accessibilityRole="button" style={({ pressed }) => [styles.button, styles.stopButton, (pressed || busy) && styles.pressed]}>
          <Text style={styles.stopLabel}>{busy ? "Working…" : "Stop autonomous trading"}</Text>
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
  stopButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: dark.muted },
  stopLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.ink },
  pressed: { opacity: 0.8 },
});
