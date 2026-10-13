import AsyncStorage from "@react-native-async-storage/async-storage";

const key = "opencash.autofund";

let on = true;
const listeners = new Set<(value: boolean) => void>();

export const autoFundEnabled = () => on;

export function subscribeAutoFund(listener: (value: boolean) => void): () => void {
  listeners.add(listener);
  listener(on);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadAutoFund(): Promise<void> {
  try {
    on = (await AsyncStorage.getItem(key)) !== "off";
  } catch {
    on = true;
  }
  listeners.forEach((listener) => listener(on));
}

export function setAutoFund(next: boolean): void {
  on = next;
  void AsyncStorage.setItem(key, next ? "on" : "off").catch(() => {});
  listeners.forEach((listener) => listener(on));
}
