import { Image, type ColorValue } from "react-native";
import { color } from "../theme";

type MarkProps = {
  size?: number;
  tint?: ColorValue;
};

export function Mark({ size = 48, tint = color.ink }: MarkProps) {
  return (
    <Image
      source={require("../../assets/mark.png")}
      style={{ width: size, height: size, tintColor: tint }}
      resizeMode="contain"
    />
  );
}
