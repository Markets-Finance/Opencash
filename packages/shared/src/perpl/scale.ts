export const collateralDecimals = 6;

function scale(decimals: number): number {
  return 10 ** decimals;
}

export function toScaled(value: number, decimals: number): bigint {
  return BigInt(Math.round(value * scale(decimals)));
}

export function fromScaled(value: bigint, decimals: number): number {
  return Number(value) / scale(decimals);
}

export function toCNS(amount: number): bigint {
  return toScaled(amount, collateralDecimals);
}

export function fromCNS(value: bigint): number {
  return fromScaled(value, collateralDecimals);
}

export function toPNS(price: number, priceDecimals: number): bigint {
  return toScaled(price, priceDecimals);
}

export function fromPNS(value: bigint, priceDecimals: number): number {
  return fromScaled(value, priceDecimals);
}

export function toLNS(lots: number, lotDecimals: number): bigint {
  return toScaled(lots, lotDecimals);
}

export function fromLNS(value: bigint, lotDecimals: number): number {
  return fromScaled(value, lotDecimals);
}

export function toLeverageHdths(leverage: number): bigint {
  return BigInt(Math.round(leverage * 100));
}

export function fromLeverageHdths(value: bigint): number {
  return Number(value) / 100;
}

export function maxLeverageFromInitialMargin(initialMarginHdths: bigint): number {
  return fromLeverageHdths(initialMarginHdths);
}
