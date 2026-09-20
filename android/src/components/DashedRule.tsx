import { StyleSheet, View } from "react-native";
import { color } from "../theme";

export function DashedRule() {
  return <View style={styles.rule} />;
}

const styles = StyleSheet.create({
  rule: {
    borderTopWidth: 1,
    borderColor: color.line,
    borderStyle: "dashed",
  },
});
