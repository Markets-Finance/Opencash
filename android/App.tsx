import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Landing } from "./src/screens/Landing";
import { color } from "./src/theme";

export default function App() {
  const [loaded, error] = useFonts({
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  if (!loaded && !error) {
    return <View style={{ flex: 1, backgroundColor: color.paper }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Landing />
    </SafeAreaProvider>
  );
}
