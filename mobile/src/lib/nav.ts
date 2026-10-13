let backOverride: (() => boolean) | null = null;

export function setBackOverride(handler: (() => boolean) | null): void {
  backOverride = handler;
}

export function runBackOverride(): boolean {
  return backOverride?.() ?? false;
}
