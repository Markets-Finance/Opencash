import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { binById, type BinSizingIssue, type SizedBin, type TradingAccount } from "shared";
import {
  fetchReceipts,
  proposeAction,
  type Mandate,
  type Proposal,
  type Receipt,
} from "../lib/backend";
import { loadTokens, openBin, sizeProposal, type EntryStep, type HoodData } from "../lib/hood";
import { family, space, track } from "../theme";

type MandateDetailProps = {
  mandate: Mandate;
  trader: TradingAccount;
  onBack: () => void;
};

const stepLabels: Record<EntryStep, string> = {
  approve: "Approving USDG…",
  swap: "Swapping every leg…",
};

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function MandateDetail({ mandate, trader, onBack }: MandateDetailProps) {
  const insets = useSafeAreaInsets();
  const bin = binById(mandate.binId);
  const [tokens, setTokens] = useState<HoodData | null>(null);
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [sized, setSized] = useState<{ sized: SizedBin; issues: BinSizingIssue[] } | null>(null);
  const [proposing, setProposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  function reloadReceipts() {
    fetchReceipts(mandate.id)
      .then(setReceipts)
      .catch(() => setReceipts(null));
  }

  useEffect(() => {
    loadTokens().then(setTokens).catch(() => setTokens(null));
    reloadReceipts();
  }, [mandate.id]);

  async function getProposal() {
    setProposing(true);
    setFailed(false);
    setStatus(null);
    try {
      const next = await proposeAction(mandate.id);
      setProposal(next);
      if (tokens && next.usdgAmount > 0) {
        const result = await sizeProposal(next.binId, next.usdgAmount, tokens.tokens);
        setSized(result);
      } else {
        setSized(null);
      }
      reloadReceipts();
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setProposing(false);
    }
  }

  async function execute() {
    if (!sized || sized.sized.legs.length === 0) return;
    setBusy(true);
    setFailed(false);
    try {
      setStatus("Waiting for your passkey…");
      await openBin(trader, sized.sized, (step) => setStatus(stepLabels[step]));
      setStatus("Executed.");
      setProposal(null);
      setSized(null);
      reloadReceipts();
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const canExecute = sized !== null && sized.sized.legs.length > 0 && !busy;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.heading}>{bin?.name ?? mandate.binId}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.section }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Policy</Text>
          <Text style={styles.policy}>{mandate.policyText}</Text>
          <Text style={styles.budget}>Lifetime budget ${mandate.usdgBudget}</Text>
        </View>

        <Pressable
          disabled={proposing || tokens === null}
          onPress={() => void getProposal()}
          style={[styles.cta, (proposing || tokens === null) && styles.ctaDisabled]}
        >
          {proposing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaLabel}>
              {tokens === null ? "Loading markets…" : "Get SERV's proposal"}
            </Text>
          )}
        </Pressable>

        {proposal !== null && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>SERV proposes</Text>
            <Text style={styles.proposalAmount}>{usd(proposal.usdgAmount)}</Text>
            <Text style={styles.reasoning}>{proposal.reasoning}</Text>

            {sized && sized.sized.legs.length > 0 && (
              <View style={styles.legs}>
                {sized.sized.legs.map((leg) => (
                  <View key={leg.leg.symbol} style={styles.legRow}>
                    <Text style={styles.legSymbol}>{leg.leg.symbol}</Text>
                    <View style={styles.spacer} />
                    <Text style={styles.legStat}>${leg.usdgIn.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}

            {sized && sized.issues.length > 0 && (
              <Text style={styles.warn}>
                {sized.issues.map((issue) => issue.detail).join(" · ")}
              </Text>
            )}

            <Pressable
              disabled={!canExecute}
              onPress={() => void execute()}
              style={[styles.cta, !canExecute && styles.ctaDisabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaLabel}>
                  {proposal.usdgAmount <= 0 ? "Nothing to execute" : "Execute with my passkey"}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {status !== null && (
          <Text style={[styles.status, failed && styles.statusFailed]}>{status}</Text>
        )}

        <Text style={styles.fieldLabel}>History</Text>
        {receipts === null ? (
          <ActivityIndicator color="#090909" />
        ) : receipts.length === 0 ? (
          <Text style={styles.empty}>No proposals yet.</Text>
        ) : (
          <View style={styles.card}>
            {receipts.map((receipt) => (
              <View key={receipt.id} style={styles.receiptRow}>
                <Text style={styles.receiptStatus}>{receipt.status}</Text>
                <Text style={styles.receiptDetail}>{receipt.detail}</Text>
              </View>
            ))}
          </View>
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
  card: { padding: space.lg, borderRadius: 18, backgroundColor: "#fafafa", gap: space.sm },
  fieldLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
  },
  policy: { fontFamily: family.regular, fontSize: 14, color: "#131315" },
  budget: { fontFamily: family.medium, fontSize: 12, color: "#4e4e51" },
  cta: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { fontFamily: family.medium, fontSize: 15, color: "#fff" },
  proposalAmount: {
    fontFamily: family.semibold,
    fontSize: 26,
    letterSpacing: track(26, -0.03),
    color: "#131315",
  },
  reasoning: { fontFamily: family.regular, fontSize: 13, lineHeight: 13 * 1.6, color: "#77777a" },
  legs: { gap: space.xs },
  legRow: { flexDirection: "row", alignItems: "center" },
  legSymbol: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  spacer: { flex: 1 },
  legStat: { fontFamily: family.regular, fontSize: 13, color: "#4e4e51" },
  warn: { fontFamily: family.regular, fontSize: 12, color: "#a5382a" },
  status: { fontFamily: family.regular, fontSize: 13, color: "#4e4e51" },
  statusFailed: { color: "#a5382a" },
  empty: { fontFamily: family.regular, fontSize: 13, color: "#858589" },
  receiptRow: { gap: 2 },
  receiptStatus: { fontFamily: family.semibold, fontSize: 12, color: "#131315" },
  receiptDetail: { fontFamily: family.regular, fontSize: 12, color: "#77777a" },
});
