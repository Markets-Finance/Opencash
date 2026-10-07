# What we are building on Monad

Compiled 2026-10-07, branch `monad`. Web-sourced figures are as reported by the source and not
re-verified on-chain. Durable notes live in the OpenCash vault (`monad-product-research-2026-10-07`,
`binsx-direction`, `perpl-write-path-verified`). The earlier Hyperliquid research and plan live on the
`hood` branch only.

## Product

**binsx on Perpl.** A bin is a thematic basket of perp legs on Monad that opens atomically in one
`execOrders` transaction (`revertOnFail = true`) and is signed by the user's own passkey-derived key.
The product sells the narrative; the mechanism is convenience without custody: Perpl API keys can trade
but cannot withdraw.

## Market

- Perpl: ~$50.7M 24h volume, $12.2M open interest, $1.03B 30d volume (DefiLlama via search summary).
- Monad perps volume reached a record $2.5B in August 2026; other venues are Drake and LeverUp.
- RWA on Monad passed $400-450M; prediction markets (Castora, Funfair, CRSHmarket) are still unmeasured.
- Metropolis Track 1 submissions close 13 Oct 2026. Other entries found: YoTrade (tournaments), MONA (copy
  trading), xorr (agent council), Metrix AI. None found offering multi-leg baskets; a search is not proof.

## Open risks

1. First user: "retail investors" is the phrase the Track 1 brief warns against.
2. Fill quality is bounded by the thinnest leg; sizing is per leg, not per bin.
3. Exit is harder than entry: one-click out, partial exits and illiquid legs are the real product.
4. No testnet AUSD faucet located; nothing has been submitted to live testnet or mainnet yet.

## Code map

| Path | Role |
|---|---|
| `packages/shared/src/perpl/` | Perpl ABI, scaling, markets, orders, account reads |
| `packages/shared/src/bins/` | bin catalog, sizing, entry/exit orders, positions |
| `packages/shared/src/terminal/` | `createTerminal`: the trading flow both clients share |
| `mobile/src/lib/perpl.ts`, `web/src/scripts/perpl.ts` | client wiring (public client + wallet client) |
| `web/src/scripts/dashboard/` | dashboard modules: gate, tabs, home, bins, trade, account |
