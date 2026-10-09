export type Stance = "buying" | "selling" | "flat";

export type NetflowRow = {
  token_symbol: string;
  chain: string;
  token_address?: string;
  net_flow_1h_usd: number;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  trader_count: number;
};

export type SmartPulse = {
  symbol: string;
  flow1hUsd: number;
  flow24hUsd: number;
  flow7dUsd: number;
  flow30dUsd: number;
  traders: number;
  tokens: string[];
  stance: Stance;
};

export type BinAgreement = {
  agree: number;
  against: number;
  flat: number;
  unknown: number;
  total: number;
  netUsd: number;
  label: string;
};

export type WalletIntel = {
  address: string;
  labels: { label: string; category: string; kind: string }[] | null;
  pnl: {
    realizedUsd: number;
    realizedPercent: number;
    winRate: number;
    tradedTokens: number;
    trades: number;
    topTokens: { symbol: string; realizedUsd: number }[];
  } | null;
  balances: { symbol: string; valueUsd: number }[] | null;
  related: { address: string; label: string | null; relation: string }[] | null;
  creditsUsed: number;
  fetchedAt: number;
};
