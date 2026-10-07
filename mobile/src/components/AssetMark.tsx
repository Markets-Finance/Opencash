import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { stockLogoUrl } from "shared";
import { dark, family } from "../theme";

type AssetMarkProps = {
  symbol: string;
  size?: number;
  uri?: string;
};

// Robinhood's own registry logoUrl turned out to be a red herring — every
// token returns the same generic Robinhood brand mark, not a real
// per-company logo (verified: identical bytes across several symbols).
// Financial Modeling Prep's image CDN is free, unauthenticated, and keyed
// directly by ticker, so this needs no registry lookup at all — just falls
// back to a letter mark on a failed image load.
export function AssetMark({ symbol, size = 32, uri }: AssetMarkProps) {
  const logoUrl = uri ?? stockLogoUrl(symbol);
  const [failed, setFailed] = useState(false);
  const showLogo = !failed;

  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size / 2 },
        showLogo && styles.markLogo,
      ]}
    >
      {showLogo ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.markText, { fontSize: size * 0.42 }]}>
          {symbol.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

type LegStackProps = {
  symbols: string[];
  size?: number;
};

export function LegStack({ symbols, size = 26 }: LegStackProps) {
  return (
    <View style={styles.stack}>
      {symbols.slice(0, 4).map((symbol, index) => (
        <View
          key={symbol}
          style={[
            styles.stackItem,
            { marginLeft: index === 0 ? 0 : -size * 0.3, borderRadius: size / 2 + 2 },
          ]}
        >
          <AssetMark symbol={symbol} size={size} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: dark.surfaceLine,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  markLogo: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e0d9",
  },
  markText: { fontFamily: family.semibold, color: "#fff" },
  stack: { flexDirection: "row" },
  stackItem: { borderWidth: 2, borderColor: dark.surface },
});
