export function toScaled(value: number, decimals: number): bigint {
  return BigInt(Math.round(value * 10 ** decimals));
}

export function fromScaled(value: bigint, decimals: number): number {
  return Number(value) / 10 ** decimals;
}
