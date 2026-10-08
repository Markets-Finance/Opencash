import type { IntentsToken, QuoteParams, QuoteResponse, StatusResponse } from "./types.js";

export const auroraUrl = "https://intents-api.aurora.dev";

export type PersistentAddress = { depositAddress: string; alreadyExists: boolean; memo?: string };

export type PersistentDeposit = {
  tx_hash: string;
  fromChain?: string;
  destinationChain?: string;
  asset_id: string;
  decimals: number;
  amount: string;
  from?: string;
  created_at: string;
  deposit_address: string;
  recipient: string;
};

export class AuroraError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type AuroraConfig = { apiKey: string; baseUrl?: string; fetcher?: typeof fetch };

export function createAuroraClient(config: AuroraConfig) {
  const base = config.baseUrl ?? auroraUrl;
  const fetcher = config.fetcher ?? fetch;
  const key = encodeURIComponent(config.apiKey);
  const json = { "Content-Type": "application/json" };

  async function read<T>(response: Response, label: string): Promise<T> {
    const text = await response.text();
    if (!response.ok) {
      let message = text.slice(0, 200);
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? message;
      } catch {
        message = text.slice(0, 200);
      }
      throw new AuroraError(response.status, `${label}: ${message}`);
    }
    return JSON.parse(text) as T;
  }

  return {
    async getTokens(): Promise<IntentsToken[]> {
      const body = await read<{ tokens: IntentsToken[] }>(await fetcher(`${base}/api/tokens/${key}`), "Aurora tokens");
      return body.tokens;
    },

    async requestQuote(params: QuoteParams): Promise<QuoteResponse> {
      const deadline = new Date(Date.now() + (params.deadlineMs ?? 10 * 60_000)).toISOString();
      const body = {
        dry: params.dry ?? true,
        swapType: "EXACT_INPUT",
        slippageTolerance: params.slippageBps ?? 100,
        originAsset: params.originAsset,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: params.destinationAsset,
        amount: params.amount,
        recipient: params.recipient,
        recipientType: "DESTINATION_CHAIN",
        refundTo: params.refundTo,
        refundType: "ORIGIN_CHAIN",
        deadline,
      };
      return read(await fetcher(`${base}/api/quote/${key}`, { method: "POST", headers: json, body: JSON.stringify(body) }), "Aurora quote");
    },

    async getStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse> {
      const query = new URLSearchParams({ depositAddress, ...(depositMemo ? { depositMemo } : {}) });
      return read(await fetcher(`${base}/api/status/${key}?${query}`), "Aurora status");
    },

    async submitDeposit(depositAddress: string, txHash: string): Promise<void> {
      await read(
        await fetcher(`${base}/api/deposit/submit/${key}`, { method: "POST", headers: json, body: JSON.stringify({ depositAddress, txHash }) }),
        "Aurora deposit",
      );
    },

    async createPersistentAddress(input: {
      recipient: string;
      sender: string;
      depositChain: string;
      destinationChain: string;
      destinationAsset: string;
    }): Promise<PersistentAddress> {
      return read(
        await fetcher(`${base}/api/persistent-deposit-address/${key}`, { method: "POST", headers: json, body: JSON.stringify(input) }),
        "Aurora persistent address",
      );
    },

    async persistentDeposits(address: string, type: "received" | "success" | "failed" = "success", limit = 10): Promise<PersistentDeposit[]> {
      const query = new URLSearchParams({ type, address, limit: String(limit) });
      const body = await read<{ deposits: PersistentDeposit[] }>(
        await fetcher(`${base}/api/persistent-deposit-status/${key}?${query}`),
        "Aurora persistent status",
      );
      return body.deposits;
    },
  };
}

export type AuroraClient = ReturnType<typeof createAuroraClient>;
