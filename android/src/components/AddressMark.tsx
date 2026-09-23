import { StyleSheet, View } from "react-native";
import { color, radius } from "../theme";

const palette = [color.purple, color.ink, color.purpleLabel];
const grid = 5;
const columns = 3;

type AddressMarkProps = {
  address: string;
  variant: number;
  size?: number;
};

export function AddressMark({ address, variant, size = 96 }: AddressMarkProps) {
  const hex = address.slice(2).toLowerCase();
  const nibble = (index: number) =>
    parseInt(hex[(index + variant * columns) % hex.length] ?? "0", 16);

  const fill = palette[nibble(hex.length - 1) % palette.length] ?? color.purple;
  const cell = size / grid;

  return (
    <View style={[styles.mark, { width: size, height: size }]}>
      {Array.from({ length: grid }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: grid }, (_, col) => {
            const mirrored = col < columns ? col : grid - 1 - col;
            const on = nibble(row * columns + mirrored) > 7;
            return (
              <View
                key={col}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: on ? fill : "transparent",
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: color.line,
    borderRadius: radius,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
  },
});
