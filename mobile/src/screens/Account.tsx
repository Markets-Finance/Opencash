import { isMeraError } from "@category-labs/mera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hood, isDevAuth, type TradingAccount } from "shared";
import { PassCard } from "../components/PassCard";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { DashedRule } from "../components/DashedRule";
import { SectionLabel } from "../components/SectionLabel";
import { createAccount, revealPhrase, signIn } from "../lib/mera";
import { color, family, radius, space, track } from "../theme";

const profileKey = "opencash.profile";

export type Profile = { name: string; email: string; variant?: number };

type Panel = "profile" | "settings" | "history" | "wallets" | null;

const failures: Record<string, string> = {
  PRF_UNAVAILABLE:
    "This passkey cannot derive keys. Its authenticator does not support the PRF extension, so it cannot be used for an OpenCash account. Try a passkey stored in iCloud Keychain, Google Password Manager or 1Password.",
  PASSKEY_OPERATION_FAILED:
    "The passkey prompt was cancelled or unavailable.",
  CRYPTO_UNAVAILABLE: "This device is missing a required crypto primitive.",
};

type ActionProps = {
  label: string;
  onPress: () => void;
  emphasis?: "primary" | "outline" | "quiet";
};

function Action({ label, onPress, emphasis = "outline" }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        emphasis === "primary" && styles.actionPrimary,
        emphasis === "quiet" && styles.actionQuiet,
        pressed && styles.actionPressed,
      ]}
    >
      <Text
        style={[
          styles.actionLabel,
          emphasis === "primary" && styles.actionLabelPrimary,
          emphasis === "quiet" && styles.actionLabelQuiet,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Account({
  initialAccount,
  initialProfile,
  portfolio,
  onBack,
  onAuthenticated,
  onProfileChange,
  onInitialised,
  onSelectTab,
}: {
  initialAccount: TradingAccount | null;
  initialProfile: Profile | null;
  portfolio: number | null;
  onBack: () => void;
  onAuthenticated: (account: TradingAccount | null) => void;
  onProfileChange: (profile: Profile | null) => void;
  onInitialised: () => void;
  onSelectTab: (key: TabKey) => void;
}) {
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState<TradingAccount | null>(initialAccount);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [variant, setVariant] = useState(initialProfile?.variant ?? 0);
  const [formMode, setFormMode] = useState<"create" | "profile" | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  function explain(error: unknown) {
    setFailed(true);
    if (!isMeraError(error)) {
      setStatus(
        error instanceof Error ? error.message : "Something went wrong.",
      );
      return;
    }
    setStatus(failures[error.code] ?? `${error.code}: ${error.message}`);
  }

  async function loadProfile(next: TradingAccount): Promise<Profile | null> {
    const raw = await AsyncStorage.getItem(profileKey);
    if (raw === null) return null;
    try {
      return JSON.parse(next.openProfile(JSON.parse(raw)));
    } catch {
      return null;
    }
  }

  async function run(
    action: () => Promise<TradingAccount>,
    pending: string,
    created: Profile | null = null,
  ) {
    setFailed(false);
    setStatus(pending);
    try {
      const next = await action();
      const resolved = created ?? (await loadProfile(next));
      if (created !== null) {
        await AsyncStorage.setItem(
          profileKey,
          JSON.stringify(next.sealProfile(JSON.stringify(created))),
        );
      }
      setAccount(next);
      onAuthenticated(next);
      setProfile(resolved);
      onProfileChange(resolved);
      setVariant(resolved?.variant ?? 0);
      setFormMode(null);
      setStatus(
        resolved === null
          ? "Signed in. This device has no profile yet — save one below. Your address is already correct."
          : "Signed in. Your profile was decrypted locally; the key came from your passkey.",
      );
    } catch (error) {
      explain(error);
    }
  }

  function openPanel(key: Exclude<Panel, null>) {
    const next = panel === key ? null : key;
    setPanel(next);
    setPhrase(null);
    setFormMode(next === "profile" ? "profile" : null);
  }

  function signOut() {
    account?.end();
    setAccount(null);
    onAuthenticated(null);
    setProfile(null);
    onProfileChange(null);
    setVariant(0);
    setPhrase(null);
    setFormMode(null);
    setFailed(false);
    setStatus("Signed out. The derived key was zeroed.");
  }

  async function copyAddress() {
    if (account === null) return;
    await Clipboard.setStringAsync(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  async function showPhrase() {
    setFailed(false);
    setStatus("Waiting for your passkey…");
    try {
      setPhrase(await revealPhrase());
      setStatus("Write these 24 words down. Anyone who has them owns this account.");
    } catch (error) {
      explain(error);
    }
  }

  async function persistProfile(on: TradingAccount, next: Profile) {
    await AsyncStorage.setItem(
      profileKey,
      JSON.stringify(on.sealProfile(JSON.stringify(next))),
    );
    setProfile(next);
    onProfileChange(next);
  }

  async function saveProfile(next: Profile) {
    if (account === null) return;
    await persistProfile(account, next);
    setFormMode(null);
    setStatus("Saved on this device, encrypted with a key only your passkey derives.");
    onInitialised();
  }

  function submit() {
    const entered = { name: name.trim(), email: email.trim(), variant };
    if (entered.name === "" || entered.email === "") {
      setFailed(true);
      setStatus("A name and an email are both needed to label the passkey.");
      return;
    }
    if (formMode === "profile") {
      void saveProfile(entered);
      return;
    }
    void run(
      () => createAccount(entered.email, entered.name),
      "Creating a passkey…",
      entered,
    );
  }

  return (
    <View style={styles.screen}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + space.xxl,
          paddingBottom:
            account !== null && profile !== null
              ? tabBarHeight + insets.bottom + space.xl
              : insets.bottom + space.block,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {profile === null && (
        <Pressable onPress={onBack} hitSlop={space.md}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      )}

      {isDevAuth && (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>
            DEV MODE — no passkey. This is a shared test account, not yours.
          </Text>
        </View>
      )}

      {profile === null && (
        <View style={styles.head}>
          <SectionLabel>ACCOUNT</SectionLabel>
          <Text style={styles.title}>Your OpenCash identity</Text>
          <Text style={styles.lede}>
            One passkey derives your address. No seed phrase, no password,
            nothing stored on this device.
          </Text>
        </View>
      )}

      {account !== null && (
        <PassCard
          address={account.address}
          name={profile?.name ?? "Trader"}
          email={profile?.email}
          tier={isDevAuth ? "Dev account" : "Passkey pass"}
          variant={variant}
          network={`${hood.name} · ${hood.id}`}
          value={portfolio}
          copied={copied}
          onCopyAddress={() => void copyAddress()}
        />
      )}

      <DashedRule />

      <View style={styles.actions}>
        {account === null ? (
          <>
            <Action
              label="Sign in with passkey"
              emphasis="primary"
              onPress={() => void run(signIn, "Waiting for your passkey…")}
            />
            <Action
              label="Create a new account"
              onPress={() => setFormMode(formMode === "create" ? null : "create")}
            />
          </>
        ) : (
          <>
            {profile === null ? (
              <Action
                label="Save profile on this device"
                emphasis="primary"
                onPress={() => setFormMode(formMode === "profile" ? null : "profile")}
              />
            ) : (
              <>
                <View style={styles.options}>
                  {(
                    [
                      ["Profile", "profile"],
                      ["Account settings", "settings"],
                      ["History", "history"],
                      ["Wallets", "wallets"],
                    ] as const
                  ).map(([label, key]) => (
                    <Pressable
                      key={key}
                      onPress={() => openPanel(key)}
                      style={({ pressed }) => [
                        styles.option,
                        panel === key && styles.optionActive,
                        pressed && styles.actionPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          panel === key && styles.optionLabelActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {panel === "settings" && (
                  <>
                    <Action label="Show recovery phrase" onPress={showPhrase} />
                    <Action label="Sign out" emphasis="quiet" onPress={signOut} />
                  </>
                )}

                {panel === "history" && (
                  <Text style={styles.note}>
                    No trades recorded on this device yet. Filled bins will
                    appear here once an indexer is wired up.
                  </Text>
                )}

                {panel === "wallets" && (
                  <View style={styles.walletRows}>
                    <Text style={styles.note}>
                      One passkey, one address. {hood.name} · {hood.id}
                    </Text>
                    <Text style={styles.walletAddress}>{account.address}</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {phrase !== null && (
          <View style={styles.phrase}>
            <Text style={styles.phraseWords}>{phrase}</Text>
            <Text style={styles.note}>
              These 24 words rebuild this account in any wallet. Write them on
              paper. Never type them into anything but a wallet you trust.
            </Text>
            <Action
              label="Hide"
              emphasis="quiet"
              onPress={() => setPhrase(null)}
            />
          </View>
        )}

        {formMode !== null && (
          <View style={styles.form}>
            <Text style={styles.field}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ada Lovelace"
              placeholderTextColor={color.node}
              autoComplete="name"
              style={styles.input}
            />
            <Text style={styles.field}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="ada@example.com"
              placeholderTextColor={color.node}
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <Action
              label={formMode === "profile" ? "Save profile" : "Create passkey"}
              emphasis="primary"
              onPress={submit}
            />
            <Text style={styles.note}>
              {formMode === "profile"
                ? "Stored only on this device, encrypted with a key only your passkey can derive. Your address does not change."
                : "Your name and email label the passkey in your password manager, and are encrypted with a key only your passkey can derive."}
            </Text>
          </View>
        )}

        {status !== "" && (
          <Text style={[styles.status, failed && styles.statusFailed]}>
            {status}
          </Text>
        )}
      </View>
    </ScrollView>
    {account !== null && profile !== null && (
      <TabBar active="account" onSelect={onSelectTab} />
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  option: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 52,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { borderColor: color.purple, backgroundColor: "#fdfcfa" },
  optionLabel: { fontFamily: family.regular, fontSize: 14, color: color.ink },
  optionLabelActive: { fontFamily: family.medium, color: color.purpleLabel },
  walletRows: { gap: space.sm },
  walletAddress: {
    fontFamily: family.regular,
    fontSize: 12,
    color: color.ink,
  },
  screen: { flex: 1, backgroundColor: color.paper },
  root: {
    flex: 1,
    backgroundColor: color.paper,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.section,
  },
  back: {
    fontFamily: family.regular,
    fontSize: 13,
    color: color.purpleLabel,
  },
  head: {
    gap: space.lg,
  },
  title: {
    fontFamily: family.light,
    fontSize: 32,
    lineHeight: 32 * 1.12,
    letterSpacing: track(32, -0.04),
    color: color.ink,
  },
  lede: {
    fontFamily: family.light,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: "#6f6d6a",
  },
  actions: {
    gap: space.md,
  },
  action: {
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
  },
  actionPrimary: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  actionQuiet: {
    borderColor: "transparent",
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    fontFamily: family.regular,
    fontSize: 14,
    color: color.ink,
  },
  actionLabelPrimary: {
    color: color.paper,
  },
  actionLabelQuiet: {
    color: "#6f6d6a",
  },
  form: {
    gap: space.sm,
    paddingTop: space.md,
  },
  field: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: color.purpleLabel,
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
    marginBottom: space.sm,
  },
  note: {
    fontFamily: family.light,
    fontSize: 12,
    lineHeight: 12 * 1.6,
    color: "#6f6d6a",
  },
  status: {
    fontFamily: family.light,
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: "#6f6d6a",
    marginTop: space.sm,
  },
  statusFailed: {
    color: color.purple,
  },
  devBanner: {
    padding: space.md,
    borderRadius: radius,
    backgroundColor: color.purple,
  },
  devBannerText: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.08),
    color: color.paper,
    textAlign: "center",
  },
  phrase: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: color.line,
  },
  phraseWords: {
    fontFamily: family.medium,
    fontSize: 15,
    lineHeight: 15 * 1.7,
    letterSpacing: track(15, 0.02),
    color: color.ink,
  },
});
