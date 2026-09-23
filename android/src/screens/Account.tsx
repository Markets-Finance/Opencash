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
import { isDevAuth, type TradingAccount } from "shared";
import { AddressMark } from "../components/AddressMark";
import { DashedRule } from "../components/DashedRule";
import { SectionLabel } from "../components/SectionLabel";
import { createAccount, revealPhrase, signIn } from "../lib/mera";
import { color, family, radius, space, track } from "../theme";

const profileKey = "opencash.profile";
const variants = 12;

type Profile = { name: string; email: string; variant?: number };

const failures: Record<string, string> = {
  PRF_UNAVAILABLE:
    "This passkey cannot derive keys. Its authenticator does not support the PRF extension, so it cannot be used for an OpenCash account. Try a passkey stored in iCloud Keychain, Google Password Manager or 1Password.",
  PASSKEY_OPERATION_FAILED:
    "The passkey prompt was cancelled or unavailable.",
  CRYPTO_UNAVAILABLE: "This device is missing a required crypto primitive.",
};

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

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

export function Account({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [variant, setVariant] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "profile" | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

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
      setProfile(resolved);
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

  function signOut() {
    account?.end();
    setAccount(null);
    setProfile(null);
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

  async function shuffle() {
    const next = (variant + 1) % variants;
    setVariant(next);
    if (account === null || profile === null) return;
    await persistProfile(account, { ...profile, variant: next });
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
  }

  async function saveProfile(next: Profile) {
    if (account === null) return;
    await persistProfile(account, next);
    setFormMode(null);
    setStatus("Saved on this device, encrypted with a key only your passkey derives.");
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + space.xxl,
          paddingBottom: insets.bottom + space.block,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={onBack} hitSlop={space.md}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      {isDevAuth && (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>
            DEV MODE — no passkey. This is a shared test account, not yours.
          </Text>
        </View>
      )}

      <View style={styles.head}>
        <SectionLabel>ACCOUNT</SectionLabel>
        <Text style={styles.title}>Your OpenCash identity</Text>
        <Text style={styles.lede}>
          One passkey derives your address. No seed phrase, no password, nothing
          stored on this device.
        </Text>
      </View>

      {account !== null && (
        <View style={styles.card}>
          <AddressMark address={account.address} variant={variant} />
          <View style={styles.identity}>
            <Text style={styles.name}>{profile?.name ?? "Trader"}</Text>
            {profile !== null && (
              <Text style={styles.email}>{profile.email}</Text>
            )}
            <Pressable onPress={copyAddress} hitSlop={space.sm}>
              <Text style={styles.address}>
                {shortenAddress(account.address)}
              </Text>
              <Text style={styles.copy}>{copied ? "Copied" : "Copy"}</Text>
            </Pressable>
          </View>
        </View>
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
            {profile === null && (
              <Action
                label="Save profile on this device"
                emphasis="primary"
                onPress={() => setFormMode(formMode === "profile" ? null : "profile")}
              />
            )}
            <Action label="Show recovery phrase" onPress={showPhrase} />
            <Action label="Shuffle avatar" emphasis="quiet" onPress={shuffle} />
            <Action label="Sign out" emphasis="quiet" onPress={signOut} />
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
  );
}

const styles = StyleSheet.create({
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xl,
  },
  identity: {
    flex: 1,
    gap: space.sm,
  },
  name: {
    fontFamily: family.regular,
    fontSize: 18,
    letterSpacing: track(18, -0.02),
    color: color.ink,
  },
  email: {
    fontFamily: family.light,
    fontSize: 13,
    color: "#6f6d6a",
  },
  address: {
    fontFamily: family.medium,
    fontSize: 13,
    letterSpacing: track(13, 0.02),
    color: color.purpleLabel,
  },
  copy: {
    fontFamily: family.regular,
    fontSize: 10,
    letterSpacing: track(10, 0.12),
    color: color.node,
    marginTop: space.xs,
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
