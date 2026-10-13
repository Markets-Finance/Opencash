import AsyncStorage from "@react-native-async-storage/async-storage";

const key = "opencash.onboarded.v1";

export async function needsOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === null;
  } catch {
    return false;
  }
}

export function finishOnboarding(): Promise<void> {
  return AsyncStorage.setItem(key, "1").catch(() => {});
}
