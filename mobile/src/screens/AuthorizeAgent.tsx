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
import { DashedRule } from "../components/DashedRule";
import { SectionLabel } from "../components/SectionLabel";
import {
  authorizeAgent,
  isDelegated,
  readAgentSession,
  revokeAgent,
  scopeSummary,
  type AgentSession,
} from "../lib/agent";
import { color, family, radius, space, track } from "../theme";

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.section },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>← Account</Text>
      </Pressable>

      <SectionLabel>AGENT ACCESS</SectionLabel>
      <Text style={styles.title}>Let a SERV agent act for you.</Text>
      <Text style={styles.subtitle}>
        This grants a session key the right to spend USDG on your behalf,
        scoped to exactly two calls, until it expires or you revoke it. Your
        passkey signs the grant; the agent never sees it.
      </Text>

      {!delegateAddress ? (
        <Text style={styles.issue}>
          The OpenCashDelegate contract has not been deployed to Robinhood
          Chain yet, so this screen cannot do anything yet.
        </Text>
      ) : (
        <>
          <DashedRule />

          <Text style={styles.fieldLabel}>Agent address</Text>
          <TextInput
            value={agentAddress}
            onChangeText={setAgentAddress}
            placeholder="0x…"
            placeholderTextColor="#b6b4b0"
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
                <Text style={styles.chipLabel}>{preset.label}</Text>
              </Pressable>
            ))}
          </View>

          <DashedRule />

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

          <DashedRule />

          <Pressable
            disabled={!validAddress || busy}
            onPress={() => void submitAuthorize()}
            style={({ pressed }) => [
              styles.cta,
              (!validAddress || busy) && styles.ctaDisabled,
              pressed && styles.ctaPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={color.paper} />
            ) : (
              <Text style={styles.ctaLabel}>
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
  title: {
    fontFamily: family.light,
    fontSize: 28,
    lineHeight: 28 * 1.2,
    letterSpacing: track(28, -0.04),
    color: color.ink,
  },
  subtitle: {
    fontFamily: family.light,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: "#6f6d6a",
  },
  fieldLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#8a8884",
  },
  input: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: color.line,
    fontFamily: family.regular,
    fontSize: 15,
    color: color.ink,
  },
  presets: { flexDirection: "row", gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  chipActive: { borderColor: color.purple },
  chipPressed: { opacity: 0.8 },
  chipLabel: { fontFamily: family.regular, fontSize: 13, color: color.ink },
  scopeLine: {
    fontFamily: family.light,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: "#6f6d6a",
  },
  sessionState: {
    fontFamily: family.light,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: color.purpleLabel,
  },
  issue: {
    fontFamily: family.light,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#a5382a",
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
  revoke: {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: color.line,
    paddingVertical: space.md,
    alignItems: "center",
  },
  revokePressed: { borderColor: "#a5382a" },
  revokeLabel: { fontFamily: family.regular, fontSize: 14, color: "#a5382a" },
  status: {
    fontFamily: family.light,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: color.purpleLabel,
  },
  statusFailed: { color: "#a5382a" },
});
