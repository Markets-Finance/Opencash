import { signRequest } from "./sign.js";
import type { OrderSpec } from "./orders.js";

export type TradeStatus = { code: number; error?: string };

export type SubmitResult = { ok: boolean; status: TradeStatus; statuses: TradeStatus[] };

export type TradeAccount = {
  id: number;
  forwarding: boolean;
  frozen: boolean;
  lastRequestId: number;
  balanceRaw: number;
  lockedRaw: number;
  headBlock: number;
};

export class TradeApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type TradeClientConfig = {
  apiUrl: string;
  chainId: number;
  apiKey: string;
  secret: Uint8Array;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export function createTradeClient(config: TradeClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = config.apiUrl.replace(/\/$/, "");
  const now = config.now ?? Date.now;
  let counter = 0;

  async function request(method: "GET" | "POST", target: string, body?: unknown): Promise<{ status: number; json: any }> {
    const raw = body === undefined ? "" : JSON.stringify(body);
    const headers = signRequest({ apiKey: config.apiKey, secret: config.secret, chainId: config.chainId, method, target, body: raw, now: now() });
    const response = await fetchImpl(`${base}${target}`, {
      method,
      headers: { ...headers, ...(raw ? { "Content-Type": "application/json" } : {}) },
      ...(raw ? { body: raw } : {}),
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json: json ?? { error: text.slice(0, 200) } };
  }

  async function read<T>(target: string): Promise<T> {
    const reply = await request("GET", target);
    if (reply.status !== 200) throw new TradeApiError(reply.status, `GET ${target} failed: ${reply.status} ${JSON.stringify(reply.json).slice(0, 160)}`);
    return reply.json as T;
  }

  async function account(): Promise<TradeAccount> {
    const wallet = await read<{ sn: number; as?: { id: number; fw: boolean; fr: boolean; lfr: number; b: number; lb: number }[] }>("/v1/trading/wallet");
    const first = wallet.as?.[0];
    if (!first) throw new TradeApiError(404, "This wallet has no Perpl exchange account");
    return { id: first.id, forwarding: first.fw, frozen: first.fr, lastRequestId: first.lfr, balanceRaw: first.b, lockedRaw: first.lb, headBlock: wallet.sn };
  }

  function nextRequestId(lastForwarded: number): number {
    counter = Math.max(counter, lastForwarded) + 1;
    return counter;
  }

  async function submit(orders: OrderSpec[]): Promise<SubmitResult> {
    if (orders.length === 0 || orders.length > 100) throw new TradeApiError(400, "Send between 1 and 100 orders");
    const reply = await request("POST", "/v1/trading/orders", { d: orders });
    const status: TradeStatus = reply.json?.status ?? { code: reply.status === 200 ? 0 : reply.status, error: reply.json?.error };
    const statuses: TradeStatus[] = reply.json?.statuses ?? [];
    return { ok: status.code === 0 && statuses.every((item) => item.code === 0), status, statuses };
  }

  return {
    account,
    nextRequestId,
    submit,
    openOrders: () => read<{ d: unknown[] }>("/v1/trading/orders"),
    positions: () => read<{ d: unknown[] }>("/v1/trading/positions"),
  };
}

export type TradeClient = ReturnType<typeof createTradeClient>;
