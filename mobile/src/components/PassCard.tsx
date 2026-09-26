import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AddressMark } from "./AddressMark";
import { family, space, track } from "../theme";

const paper = "#f7f6f2";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type PassCardProps = {
  address: string;
  name?: string;
  email?: string;
  tier?: string;
  variant?: number;
  network?: string;
  value?: number | null;
  copied?: boolean;
  onCopyAddress?: () => void;
};

export function PassCard({
  address,
  name = "—",
  email = "",
  tier,
  variant = 0,
  network,
  value,
  copied = false,
  onCopyAddress,
}: PassCardProps) {
  return (
    <ImageBackground
      source={require("../../assets/card-field.png")}
      style={styles.card}
      imageStyle={styles.field}
      resizeMode="cover"
    >
      <View style={styles.inner}>
        <View style={styles.head}>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {email !== "" && (
              <Text style={styles.email} numberOfLines={1}>
                {email}
              </Text>
            )}
          </View>
          <Text style={styles.wordmark}>OPENCASH</Text>
        </View>

        {tier !== undefined && (
          <View style={styles.tier}>
            <Text style={styles.tierLabel}>{tier}</Text>
          </View>
        )}

        <View style={styles.avatar}>
          <View style={styles.avatarRing}>
            <AddressMark address={address} variant={variant} size={104} />
          </View>
        </View>

        {value !== undefined && (
          <View style={styles.value}>
            <Text style={styles.valueLabel}>TOTAL VALUE</Text>
            <Text style={styles.valueAmount}>
              {value === null
                ? "—"
                : `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </Text>
          </View>
        )}

        <View style={styles.details}>
          <View style={styles.detailWide}>
            <Text style={styles.detailLabel}>ADDRESS</Text>
            <Pressable
              onPress={onCopyAddress}
              disabled={onCopyAddress === undefined}
              style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
            >
              <Text style={styles.detailValue}>{shortenAddress(address)}</Text>
              {onCopyAddress !== undefined && (
                <Text style={styles.copyHint}>{copied ? "COPIED" : "COPY"}</Text>
              )}
            </Pressable>
          </View>
          {network !== undefined && (
            <View>
              <Text style={styles.detailLabel}>NETWORK</Text>
              <Text style={styles.detailValue}>{network}</Text>
            </View>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 340,
    aspectRatio: 9 / 12,
    alignSelf: "center",
  },
  field: { borderRadius: 24 },
  inner: { flex: 1, padding: space.lg },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: "rgba(247, 246, 242, 0.18)",
    borderRadius: 14,
    backgroundColor: "rgba(247, 246, 242, 0.1)",
  },
  identity: { flexShrink: 1, minWidth: 0 },
  name: {
    fontFamily: family.medium,
    fontSize: 19,
    letterSpacing: track(19, -0.03),
    color: paper,
  },
  email: {
    marginTop: 2,
    fontFamily: family.regular,
    fontSize: 12,
    color: "rgba(247, 246, 242, 0.72)",
  },
  wordmark: {
    fontFamily: family.medium,
    fontSize: 10,
    letterSpacing: track(10, 0.14),
    color: "rgba(247, 246, 242, 0.85)",
  },
  tier: {
    alignSelf: "flex-start",
    marginTop: space.md,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(37, 37, 39, 0.42)",
  },
  tierLabel: { fontFamily: family.medium, fontSize: 12, color: paper },
  avatar: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarRing: {
    padding: space.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(247, 246, 242, 0.28)",
    backgroundColor: "rgba(247, 246, 242, 0.08)",
  },
  value: { marginBottom: space.md },
  valueLabel: {
    fontFamily: family.regular,
    fontSize: 9,
    letterSpacing: track(9, 0.12),
    color: "rgba(247, 246, 242, 0.6)",
  },
  valueAmount: {
    marginTop: 2,
    fontFamily: family.light,
    fontSize: 32,
    letterSpacing: track(32, -0.03),
    color: paper,
  },
  details: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(247, 246, 242, 0.14)",
    backgroundColor: "rgba(247, 246, 242, 0.08)",
  },
  detailWide: { flex: 1, minWidth: 0 },
  detailLabel: {
    fontFamily: family.regular,
    fontSize: 9,
    letterSpacing: track(9, 0.12),
    color: "rgba(247, 246, 242, 0.6)",
  },
  detailValue: {
    marginTop: 3,
    fontFamily: family.medium,
    fontSize: 13,
    color: paper,
  },
  copy: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  copyHint: {
    fontFamily: family.regular,
    fontSize: 9,
    letterSpacing: track(9, 0.1),
    color: "rgba(247, 246, 242, 0.55)",
  },
  pressed: { opacity: 0.7 },
});
