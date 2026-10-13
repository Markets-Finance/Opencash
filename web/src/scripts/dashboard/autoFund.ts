const key = "opencash.autofund";

export function autoFundOn(): boolean {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

export function setAutoFund(on: boolean) {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {}
}
