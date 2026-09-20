import { View } from "react-native";
import { color } from "../theme";

type DiamondProps = {
  size?: number;
  fill?: string;
};

export function Diamond({ size = 7, fill = color.purple }: DiamondProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: fill,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}
