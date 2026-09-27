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
import { bins, type TradingAccount } from "shared";
import { Mark } from "../components/Mark";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { createMandate, listMandates, type Mandate } from "../lib/backend";
import { family, space, track } from "../theme";

type BotHomeProps = {
  trader: TradingAccount;
  onAuthorize: () => void;
  onSelectTab: (key: TabKey) => void;
  onOpenMandate: (mandate: Mandate) => void;
};

export function BotHome({ trader, onAuthorize, onSelectTab, onOpenMandate }: BotHomeProps) {
  const insets = useSafeAreaInsets();
  const [mandates, setMandates] = useState<Mandate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [binId, setBinId] = useState(bins[0].id);
  const [policyText, setPolicyText] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    listMandates(trader.address)
      .then(setMandates)
      .catch((cause) => setError(String(cause)));
  }

  useEffect(reload, [trader.address]);

  async function submitCreate() {
    const usdgBudget = Number(budget);
    if (policyText.trim() === "") {
      setFormError("Describe the policy this mandate should follow.");
      return;
    }
    if (!(usdgBudget > 0)) {
      setFormError("Enter a lifetime USDG budget greater than 0.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await createMandate({ owner: trader.address, binId, policyText: policyText.trim(), usdgBudget });
      setPolicyText("");
      setBudget("");
      setCreating(false);
      reload();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Bot</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lede}>
          SERV reasons over a mandate you write and proposes an allocation.
          Today every proposal needs your tap to execute — it signs with your
          own passkey key, the same as any manual trade.
        </Text>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Mandates</Text>
          <Pressable onPress={() => setCreating((c) => !c)} hitSlop={12}>
            <Text style={styles.newLink}>{creating ? "Cancel" : "New mandate"}</Text>
          </Pressable>
        </View>

        {creating && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Bin</Text>
            <View style={styles.chipRow}>
              {bins.map((bin) => (
                <Pressable
                  key={bin.id}
                  onPress={() => setBinId(bin.id)}
                  style={[styles.chip, binId === bin.id && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, binId === bin.id && styles.chipLabelActive]}>
                    {bin.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Policy</Text>
            <TextInput
              value={policyText}
              onChangeText={setPolicyText}
              placeholder="e.g. Allocate in $25 steps only while under budget"
              placeholderTextColor="#b3b3b6"
              multiline
              style={styles.textArea}
            />

            <Text style={styles.fieldLabel}>Lifetime USDG budget</Text>
            <TextInput
              value={budget}
              onChangeText={setBudget}
              placeholder="0"
              placeholderTextColor="#b3b3b6"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Pressable
              disabled={busy}
              onPress={() => void submitCreate()}
              style={[styles.cta, busy && styles.ctaDisabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaLabel}>Create mandate</Text>
              )}
            </Pressable>
            {formError !== null && <Text style={styles.formError}>{formError}</Text>}
          </View>
        )}

        {error !== null ? (
          <Text style={styles.formError}>{error}</Text>
        ) : mandates === null ? (
          <ActivityIndicator color="#090909" />
        ) : mandates.length === 0 ? (
          <Text style={styles.empty}>No mandates yet.</Text>
        ) : (
          mandates.map((mandate) => {
            const bin = bins.find((b) => b.id === mandate.binId);
            return (
              <Pressable
                key={mandate.id}
                onPress={() => onOpenMandate(mandate)}
                style={({ pressed }) => [styles.mandateRow, pressed && styles.pressed]}
              >
                <Text style={styles.mandateBin}>{bin?.name ?? mandate.binId}</Text>
                <Text style={styles.mandatePolicy} numberOfLines={2}>
                  {mandate.policyText}
                </Text>
                <Text style={styles.mandateBudget}>Budget ${mandate.usdgBudget}</Text>
              </Pressable>
            );
          })
        )}

        <View style={styles.card}>
          <View style={styles.mark}>
            <Mark size={28} tint="#fff" />
          </View>
          <Text style={styles.cardTitle}>Autonomous mode — not available yet</Text>
          <Text style={styles.cardBody}>
            Unattended execution (SERV trades without a tap) needs a scoped
            session key granted through the OpenCashDelegate contract, which
            isn't deployed to mainnet. Mandates above work today without it —
            you approve every trade.
          </Text>
          <Pressable
            onPress={onAuthorize}
            style={({ pressed }) => [styles.ctaOutline, pressed && styles.pressed]}
          >
            <Text style={styles.ctaOutlineLabel}>See what it would grant</Text>
          </Pressable>
        </View>
      </ScrollView>

      <TabBar active="home" onSelect={onSelectTab} />
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
    fontSize: 25,
    letterSpacing: track(25, -0.04),
    color: "#0c0c0c",
  },
  iconButton: { width: 54, height: 54, borderRadius: 27 },
  content: { padding: space.lg, gap: space.lg },
  lede: {
    fontFamily: family.regular,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: "#77777a",
  },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
  },
  newLink: { fontFamily: family.medium, fontSize: 13, color: "#4a45c9" },
  card: {
    borderRadius: 18,
    backgroundColor: "#fafafa",
    padding: space.lg,
    gap: space.sm,
  },
  fieldLabel: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: "#858589",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderRadius: 999,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: "#f0f0f0",
  },
  chipActive: { backgroundColor: "#090909" },
  chipLabel: { fontFamily: family.medium, fontSize: 13, color: "#131315" },
  chipLabelActive: { color: "#fff" },
  textArea: {
    minHeight: 64,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    fontFamily: family.regular,
    fontSize: 14,
    color: "#131315",
    textAlignVertical: "top",
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
  formError: { fontFamily: family.regular, fontSize: 12, color: "#a5382a" },
  empty: { fontFamily: family.regular, fontSize: 13, color: "#858589" },
  mandateRow: {
    borderRadius: 18,
    backgroundColor: "#fafafa",
    padding: space.lg,
    gap: 4,
  },
  mandateBin: { fontFamily: family.semibold, fontSize: 15, color: "#131315" },
  mandatePolicy: { fontFamily: family.regular, fontSize: 13, color: "#77777a" },
  mandateBudget: { fontFamily: family.medium, fontSize: 12, color: "#4e4e51" },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#090909",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  cardTitle: {
    fontFamily: family.semibold,
    fontSize: 15,
    letterSpacing: track(15, -0.03),
    color: "#131315",
    textAlign: "center",
  },
  cardBody: {
    fontFamily: family.regular,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#77777a",
    textAlign: "center",
  },
  cta: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaLabel: { fontFamily: family.medium, fontSize: 15, color: "#fff" },
  ctaOutline: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#d7d5d1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
  ctaOutlineLabel: { fontFamily: family.medium, fontSize: 14, color: "#4e4e51" },
  pressed: { opacity: 0.85 },
});
