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
import { isAddress, type Address } from "viem";
import { delegateAddress, type TradingAccount } from "shared";
import {
  authorizeAgent,
  isDelegated,
  readAgentSession,
  revokeAgent,
  scopeSummary,
  type AgentSession,
} from "../lib/agent";
import { family, space, track } from "../theme";

type AuthorizeAgentProps = {
  trader: TradingAccount;
  onBack: () => void;
};

const durationPresets = [
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "30 days", seconds: 30 * 24 * 60 * 60 },
  { label: "90 days", seconds: 90 * 24 * 60 * 60 },
];

function formatExpiry(expiry: bigint): string {
  return new Date(Number(expiry) * 1000).toLocaleString();
}

export function AuthorizeAgent({ trader, onBack }: AuthorizeAgentProps) {
  const insets = useSafeAreaInsets();
  const [agentAddress, setAgentAddress] = useState("");
  const [duration, setDuration] = useState(durationPresets[1].seconds);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [delegated, setDelegated] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const validAddress = isAddress(agentAddress);

  useEffect(() => {
    if (!validAddress || !delegateAddress) {
      setSession(null);
      return;
    }
    let live = true;
    Promise.all([
      isDelegated(trader.address),
      readAgentSession(trader.address, agentAddress as Address),
    ])
      .then(([isDel, next]) => {
        if (!live) return;
        setDelegated(isDel);
        setSession(next);
      })
      .catch(() => live && setSession(null));
    return () => {
      live = false;
    };
  }, [validAddress, agentAddress, trader.address]);

  async function submitAuthorize() {
    setBusy(true);
    setFailed(false);
    try {
      setStatus("Waiting for your passkey…");
      await authorizeAgent(trader, agentAddress as Address, duration);
      const [isDel, next] = await Promise.all([
        isDelegated(trader.address),
        readAgentSession(trader.address, agentAddress as Address),
      ]);
      setDelegated(isDel);
      setSession(next);
      setStatus(`Agent authorized until ${formatExpiry(next.expiry)}.`);
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitRevoke() {
    setBusy(true);
    setFailed(false);
    try {
      setStatus("Waiting for your passkey…");
      await revokeAgent(trader, agentAddress as Address);
      const next = await readAgentSession(trader.address, agentAddress as Address);
      setSession(next);
      setStatus("Agent access revoked.");
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.heading}>Agent access</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.section }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          This grants a session key the right to spend USDG on your behalf,
          scoped to exactly two calls, until it expires or you revoke it. Your
          passkey signs the grant; the agent never sees it.
        </Text>

        {!delegateAddress ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              The OpenCashDelegate contract has not been deployed to Robinhood
              Chain yet, so this screen cannot do anything yet.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Agent address</Text>
              <TextInput
                value={agentAddress}
                onChangeText={setAgentAddress}
                placeholder="0x…"
                placeholderTextColor="#b3b3b6"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Expires in</Text>
              <View style={styles.presets}>
                {durationPresets.map((preset) => (
                  <Pressable
                    key={preset.label}
                    onPress={() => setDuration(preset.seconds)}
                    style={({ pressed }) => [
                      styles.chip,
                      duration === preset.seconds && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        duration === preset.seconds && styles.chipLabelActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>This grant allows</Text>
              {scopeSummary().map((line) => (
                <Text key={line} style={styles.scopeLine}>
                  · {line}
                </Text>
              ))}

              {session !== null && (
                <Text style={styles.sessionState}>
                  {session.active
                    ? `Currently authorized until ${formatExpiry(session.expiry)}.`
                    : session.revoked
                      ? "Currently revoked."
                      : "No active grant for this address yet."}
                </Text>
              )}
              {delegated === false && (
                <Text style={styles.sessionState}>
                  Your account has not enabled agent delegation yet — authorizing
                  will do that in the same transaction.
                </Text>
              )}
            </View>

            <Pressable
              disabled={!validAddress || busy}
              onPress={() => void submitAuthorize()}
              style={({ pressed }) => [
                styles.primaryButton,
                (!validAddress || busy) && styles.primaryButtonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.primaryLabel,
                    !validAddress && styles.primaryLabelDisabled,
                  ]}
                >
                  {validAddress ? "Authorize agent" : "Enter a valid address"}
                </Text>
              )}
            </Pressable>

            {session?.active && (
              <Pressable
                disabled={busy}
                onPress={() => void submitRevoke()}
                style={({ pressed }) => [styles.revoke, pressed && styles.revokePressed]}
              >
                <Text style={styles.revokeLabel}>Revoke access</Text>
              </Pressable>
            )}

            {status !== null && (
              <Text style={[styles.status, failed && styles.statusFailed]}>{status}</Text>
            )}
          </>
        )}
      </ScrollView>
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
  subtitle: {
    fontFamily: family.regular,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: "#77777a",
  },
  card: { padding: space.lg, borderRadius: 18, backgroundColor: "#fafafa", gap: space.sm },
  fieldLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
  },
  input: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    fontFamily: family.regular,
    fontSize: 15,
    color: "#131315",
  },
  presets: { flexDirection: "row", gap: space.sm },
  chip: {
    borderRadius: 999,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: "#f0f0f0",
  },
  chipActive: { backgroundColor: "#090909" },
  chipPressed: { opacity: 0.8 },
  chipLabel: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  chipLabelActive: { color: "#fff" },
  scopeLine: {
    fontFamily: family.regular,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: "#4e4e51",
  },
  sessionState: {
    fontFamily: family.regular,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: "#858589",
  },
  warnCard: { padding: space.lg, borderRadius: 18, backgroundColor: "#fdeceb" },
  warnText: {
    fontFamily: family.regular,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#a5382a",
  },
  primaryButton: {
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: { backgroundColor: "#dcdcdc" },
  primaryButtonPressed: { opacity: 0.85 },
  primaryLabel: { fontFamily: family.medium, fontSize: 15, color: "#fff" },
  primaryLabelDisabled: { color: "#8a8a8d" },
  revoke: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#d7d5d1",
    alignItems: "center",
    justifyContent: "center",
  },
  revokePressed: { borderColor: "#a5382a" },
  revokeLabel: { fontFamily: family.medium, fontSize: 14, color: "#a5382a" },
  status: { fontFamily: family.regular, fontSize: 13, color: "#4e4e51" },
  statusFailed: { color: "#a5382a" },
});
