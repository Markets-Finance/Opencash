# How a user trades on Hyperliquid through our app

Compiled 2026-10-02. Sources: Hyperliquid docs (exchange endpoint, signing), the
`@nktkas/hyperliquid` README, Privy's Hyperliquid guide, plus the on-chain Dreamcash
teardown in `research-track1-market-structure.md`. Items marked **(unverified)** were not
confirmed against a primary source.

## 1. Pieces we integrate with

| Layer | What | Notes |
|---|---|---|
| Read API | `POST api.hyperliquid.xyz/info` | Public, no key. Positions, fills, meta, vaults. Tested live (see `research-hyperliquid.md` §4d) |
| Write API | `POST api.hyperliquid.xyz/exchange` | Body: `action`, `nonce` (ms), `signature`, optional `vaultAddress`, `expiresAfter` |
| Stream | `wss://api.hyperliquid.xyz/ws` | `userFills`, `userEvents`, `webData` subscriptions |
| TS SDK | `@nktkas/hyperliquid` (community, MIT, v0.32.x) | `ExchangeClient`, `InfoClient`, `SubscriptionClient`; takes a viem or ethers wallet; works in Node, Bun, Deno, browsers; **React Native 0.86+ with polyfills** — our mobile is RN 0.86.3 and Expo ~57 |
| Python SDK | `hyperliquid-python-sdk` (official) | Reference implementation of signing; not needed in our TS stack |
| Wallet | Privy or Turnkey passkey wallet | Privy's Hyperliquid guide converts the embedded wallet to a viem account, which the SDK accepts |
| Reference app | `HyperTrade` (Expo + FastAPI, Privy, agent signing, gasless relayer, builder fees) | Open-source prior art for the same stack |

We already have `viem` across mobile, web, shared and backend.

## 2. Two signing schemes

1. **L1 actions** (orders, cancels, modify, `updateLeverage`, `updateIsolatedMargin`):
   msgpack-hashed action signed as EIP-712 over a "phantom agent". These are the actions
   an **agent wallet** signs.
2. **User-signed actions** (`approveAgent`, `approveBuilderFee`, `usdClassTransfer`,
   `usdSend`, `withdraw3`): plain EIP-712 typed data with `hyperliquidChain` and
   `signatureChainId`. Must be signed by the **main wallet**; the Privy guide states
   outright that agents cannot withdraw.

Docs warn that a wrong signature gives no reason for failure, that msgpack field order and
trailing zeros matter, and to lowercase addresses. **Use the SDK, do not hand-roll signing.**

Note: the docs summary I fetched labelled every action "main wallet required", including
orders. That contradicts the agent-wallet model (and the Dreamcash account that never
signed an L1 tx itself). Treat the scheme split above as the working assumption and
confirm with a testnet order signed by an agent key before building on it. **(unverified)**

## 3. User flow

### A. Onboard (once)

1. User signs in with passkey → Privy/Turnkey wallet = **main wallet** (the Hyperliquid
   account address).
2. App generates a fresh **agent key** on the device (kept in the secure enclave/keystore,
   never sent to our server).
3. Main wallet signs **`approveAgent`** for the agent address → the app can now trade
   without a prompt per order.
4. Main wallet signs **`approveBuilderFee`** (builder = our address, `maxFeeRate` ≤ 0.1% for
   perps) → we earn on routed fills. One signature per user per builder.
5. Agent keys expire/are replaced by approving a new one; revoke by approving another.

### B. Fund

1. User deposits USDC on Arbitrum to the Hyperliquid bridge. Minimum **$5 USDC**.
2. Gasless path: user signs an EIP-2612 permit; our relayer submits
   `batchedDepositWithPermit` on Bridge2 and pays gas (the pattern observed on Dreamcash).
3. Funds land on HyperCore; `usdClassTransfer` moves between spot and perp balance if
   needed (main-wallet signature). Unified/portfolio-margin accounts use the spot balance
   endpoint instead.

### C. Trade a single market

1. App loads `meta` / `metaAndAssetCtxs` (per dex: main, `xyz`, `cash`, …) for the asset
   index, `szDecimals`, max leverage, funding, mark/oracle price.
2. User picks a market, side, size, **leverage** (`updateLeverage` with `isCross` and an
   integer leverage — an L1 action, agent-signed), and order type.
3. Price must satisfy ≤ 5 significant figures **and** ≤ (6 − `szDecimals`) decimals for
   perps. Size is a multiple of `10^−szDecimals`.
4. App builds the `order` action: `a` (asset index), `b`, `p`, `s`, `r`, `t`
   (`Alo` post-only / `Gtc` / `Ioc`), `grouping`, and `builder: {b, f}`. The agent key
   signs it; the SDK posts it. Default to `Alo`/`Gtc` limit orders (limit-first UX).
5. Response carries the order id and status; the app tracks fills over `userFills` /
   `userEvents`.
6. Close or reduce with `r: true`; set TP/SL via `grouping: "normalTpsl"` or
   `"positionTpsl"`; cancel with `cancel`; amend with `modify`.

### D. Trade a bin (mirror a leader)

1. Backend watches the leader's address (`clearinghouseState`, WebSocket `userFills`).
2. A leader change creates a **proposed swap**: the diff in positions, scaled to the
   user's equity and capped by the user's tier leverage.
3. App sends a **notification** with the leader's entry, the user's expected fill and
   slippage. Nothing executes without the user's tap (decided 2026-10-02).
4. On approval the agent key signs the batched `order` action; legs skipped (no market,
   over the leverage cap, too small) are listed.
5. Fills and PnL reported per leg and per bin.

### E. Withdraw

Main-wallet signature (`withdraw3`) with an explicit destination; a passkey prompt every
time. Our edge idea: allowlist or timelock on destinations, since one compromised main-key
signature drains the account.

## 4. What our backend does vs what stays on-device

| Does | Where |
|---|---|
| Passkey wallet, `approveAgent`, `approveBuilderFee`, `withdraw3` | Device (main wallet) |
| Agent key generation and order signing | Device |
| Market data, leader tracking, ranking, bin definitions, notifications | Backend |
| Gasless deposit relay | Backend relayer (pays Arbitrum gas) |
| Never | Holds a key that can move user funds; an agent key can't withdraw anyway |

Open decision: if notifications are the only trigger and the user must tap, the agent key
can live only on the device, which keeps the backend key-free. A background-trigger design
would need it server-side (not chosen).

## 5. Implementation plan

| Step | Output | Check |
|---|---|---|
| 1 | Add `@nktkas/hyperliquid` to `packages/shared`; shared `hl` client (info + exchange + ws) replacing `shared/hood` | Typecheck passes in mobile, web, backend |
| 2 | Testnet script: agent-signed order, `approveAgent`, `approveBuilderFee` | Order accepted on testnet, builder fee shows in fill |
| 3 | RN polyfills and an Expo dev build proving the SDK signs on-device | Same order from the phone |
| 4 | Passkey wallet (Privy or Turnkey) → viem account → `approveAgent` | One sign-in, then no per-order prompts |
| 5 | Market list + order ticket with leverage and limit-first, tick-rule enforcement | Matches exchange acceptance on testnet |
| 6 | Deposit flow with gasless relayer on testnet or small mainnet amount | Funds appear without the user holding ETH |
| 7 | Bin engine: leader watch → diff → notification → batched order | End-to-end mirror of a testnet leader |

## 6. Risks and open questions

- Agent-vs-main signing split (see §2) is unverified for orders; test first.
- SDK is community-maintained, not official; pin the version and review before shipping.
- React Native support needs polyfills; unverified on our Expo 57 build.
- Builder-fee approval is capped at 10 active builders per user and needs the main wallet.
- Passkey wallet choice (Privy vs Turnkey vs our WebAuthn PRF key) — Privy docs reviewed
  do not cover passkey, agent approval, or React Native specifically.
- Per-dex collateral: orders on `xyz`/`cash` need that dex's collateral; flow for moving
  funds between dexs not researched.
- Testnet availability of HIP-3 dexs **(unverified)**.

---

## 7. Onboarding, wallet connection and live data (researched 2026-10-02)

### Does a user need to "register" on Hyperliquid?

No separate registration step is documented. An account is the wallet address: connect a
wallet (or log in by email) and trade, with a first deposit funding it. Wallet users sign a
gasless "Enable Trading" message, then deposit. The docs give no minimum deposit and no
account-creation fee; Privy's guide states $5 USDC on Arbitrum as the minimum for its flow.
Deposit sources listed include USDC on Arbitrum/Ethereum/Base/Polygon plus several native
assets. Withdrawals can carry a small gas fee. Whether activation requires a first deposit
is **not stated** in the docs I read. **(unverified)**

### Wallet options

| Option | Fit | Open |
|---|---|---|
| **Privy** (`@privy-io/expo`, optional `react-native-passkeys`) | Passkey sign-up/login hooks, embedded wallet → viem account → SDK. Privy's Hyperliquid guide and builder-fee recipe exist | Passkey login is separate from wallet signing; confirm the embedded wallet signs EIP-712 `approveAgent` on Expo |
| **Turnkey** (`@turnkey/react-native-wallet-kit`) | Passkey-native auth, key held in their secure infrastructure | No Hyperliquid-specific guide found |
| **Our own WebAuthn-PRF key** (existing `shared/webauthn`) | Already built, no vendor | We own recovery, and PRF support varies by device/browser; no precedent for Hyperliquid |
| **External wallet** (MetaMask/WalletConnect) | Matches Hyperliquid's own flow | Weak mobile UX; not our wedge |

Default to evaluating **Privy first** (prior art: HyperTrade, Based, Liquid), keeping our own
PRF key as the fallback. Decide after a spike that signs `approveAgent` from an Expo build.

### Live data: what the limits allow

| Limit (per IP) | Value |
|---|---|
| REST weight | 1,200/min; `clearinghouseState`, `allMids`, `l2Book` weigh 2, most other info calls 20 |
| WebSocket | 10 connections, 30 new connections/min, 1,000 subscriptions, 2,000 messages/min |
| **WebSocket users** | **10 unique users per IP for user-specific subscriptions** |
| Address (exchange actions) | 1 request per 1 USDC traded cumulatively, 10,000-request starting buffer |

Global streams (no user needed): `allMids` (optional `dex`), `l2Book`, `trades`, `candle`,
`activeAssetCtx`. Per-user streams: `userFills`, `userEvents`, `orderUpdates`,
`userFundings`, `clearinghouseState` / `openOrders` (both take `dex`), `webData3`.

Design consequences:
- **The user's own account** is read on the device, over the user's own IP: market data,
  positions, orders, fills. No backend load, no shared limit.
- **Leader tracking is the bottleneck.** One backend IP can stream only 10 leaders over
  WebSocket. Polling `clearinghouseState` costs weight 2, so ~600 polls/min: e.g. 60 leaders
  every 6 s. A first catalogue of 10 live streamed leaders plus a few dozen polled ones fits
  one IP; scaling past that needs more egress IPs. My earlier 150-address pull ran at
  ~3 req/s, inside the limit.
- Use `webData3`/`clearinghouseState` with `dex` to cover `xyz` positions, since leader
  positions are per dex.

### What got built from this (2026-10-02)

`packages/shared/src/hl/` — read-only, no keys: `createHlInfo(network)`, `listDexes`,
`listMarkets(info, dex)` (mark/oracle, volume, OI, funding, `maxLeverage`, `szDecimals`,
`assetId`), and `getAccount(info, user, dex)` (equity, notional, effective leverage,
positions). Added `@nktkas/hyperliquid` ^0.33.3, exported from `shared`. Typechecks, and a
live run against mainnet returned 11 dexes, 178 main-book markets (BTC 40x, ETH 25x), 110
`xyz` markets (SP500 50x, XYZ100 30x) and a leader account (1 SOL position, 3.6x).

Findings from that run:
- **`cash` returned 0 markets via `metaAndAssetCtxs`** although `perpDexs` lists it —
  the earlier dossier reported 17. Not yet explained; check the `dex` name or that it was
  retired.
- `assetId` for non-main dexes uses `100000 + dexIndex*10000 + i` from my recollection of
  the docs; **unverified until an order for an `xyz` asset is accepted on testnet.**
- Installing the SDK made pnpm prune ~134 packages (hoisted linker, lockfile shrank by
  ~500 lines); they were deps of the code already deleted in the working tree, but check
  `git diff pnpm-lock.yaml` before committing.

## 8. Testnet script run (2026-10-02)

Script: `backend/scripts/hl-testnet.ts` (generates throwaway main and agent keys into the
gitignored `backend/.env`, never prints them). Steps: `approveAgent`, optional
`approveBuilderFee` (set `HL_TESTNET_BUILDER`), agent `updateLeverage`, agent post-only
BTC order, agent `withdraw3` (expected refusal).

Result on a fresh, unfunded testnet wallet — every step rejected before any rule could be
tested:

| Step | Error |
|---|---|
| `approveAgent` (main) | `Must deposit before performing actions` |
| agent `updateLeverage` / `order` | `User or API Wallet … does not exist` (agent never approved) |
| agent `withdraw3` | `Must deposit before performing actions` |

Confirmed: **an account is inactive until it has a deposit**, so first-deposit activation
is real, not optional. The requests were well-formed enough to reach account checks;
whether the signatures are valid is not yet proven.

Testnet funding: mock USDC (1,000 per claim at `app.hyperliquid-testnet.xyz/drip`) needs
the **same address** to have deposited **≥ $5 USDC on mainnet** first (web). So the
testnet wallet needs real money, or a wallet that already has a mainnet deposit.

Testnet does have HIP-3 dexes (`xyz`, `flx`, `test`, `felix`, … 200+ listed), and the
`100000 + dexIndex*10000 + i` pattern matched the dex IDs the SDK listed there (e.g.
`felix:TSLA` = 140001). Still needs an accepted order to confirm.

Blocked on: a funded wallet. Options — (a) deposit ≥ $5 USDC on mainnet from the throwaway
main wallet, claim testnet USDC, run the script; (b) run the same script on mainnet with a
small real deposit and a tiny far-from-market post-only order; (c) point the script at a
wallet you already funded, supplying its key only through `backend/.env`.

## 9. Funded testnet run (2026-10-02) — signing model verified

Wallet `0x4336…6A14` (key in `backend/.env` as `MAIN_PRIVATE_KEY`, never printed): mainnet
activated by the user's own deposit (4.99 USDC spot, untouched, never traded), testnet
credited 999 USDC. All trading on testnet only.

| Step | Result |
|---|---|
| `approveAgent` signed by the main wallet | **OK** |
| `updateLeverage` signed by the **agent** key | **OK** |
| Post-only BTC limit order signed by the **agent** key | **OK** — resting, oid returned, then cancelled by the agent (cancel OK) |
| `xyz:XYZ100` order (asset id 750000) | Reached margin check: `Insufficient margin to place order. asset=750000` — the id was accepted, the dex has its own collateral (account value on `xyz` is 0) |
| `felix:TEST` order | `Order has zero size` — rounding on a 0-decimal market with my test sizing, not a protocol result |
| Agent `withdraw3` | Rejected, but **inconclusive**: it was signed with the agent as the acting user (`Must deposit before performing actions`), so it did not test the real rule |

Settled: **agents can sign orders, leverage and cancels; the main wallet approves the
agent.** This resolves the signing question left open in §2/§6 for L1 actions.
`assetId = 100000 + dexIndex*10000 + i` is consistent with the testnet (id 750000 for the
first `xyz` market means `xyz` sits at dex index 65 there; mainnet differs).

Not tested: `approveBuilderFee` (needs a builder address), that an agent cannot withdraw
for the main account, HIP-3 collateral funding into a dex (`xyz` has its own margin),
and `userFills`/WebSocket on this account.

## 10. Spot, transfers, order and withdraw infra (2026-10-02)

Added to `packages/shared/src/hl/` (typechecks; all runs on testnet):

| Module | API |
|---|---|
| `client.ts` | `createHlInfo(network)`, `createHlExchange(network, wallet)` |
| `spot.ts` | `listSpotMarkets` (pair, `assetId = 10000 + index`, base `szDecimals`, mark, volume), `getSpotBalances` |
| `orders.ts` | `formatPrice` / `formatSize` (tick rule: ≤ 5 sig figs, ≤ MAX_DECIMALS − `szDecimals` decimals, MAX 6 perp / 8 spot, integers ≥ 100000 unrounded), `placeLimitOrder` (default post-only `Alo`, optional builder fee), `cancelOrder`, `setLeverage` |
| `transfers.ts` | `moveUsd` (perp ↔ spot), `withdrawUsd` |
| `backend/scripts/hl-flows.ts` | testnet-only end-to-end script (network hard-coded) |

Testnet results for wallet `0x4336…6A14`:

| Flow | Result |
|---|---|
| Perp → spot transfer 20 USDC (main wallet) | **OK**; perp 999 → 979, spot USDC 20 |
| Perp post-only BTC order via `placeLimitOrder` (agent) + cancel | **OK** |
| Spot post-only on `PURR/USDC` (agent, 5% below mark) + cancel | **OK** |
| Spot order on `PUCKY/USDC` at 5% and 15% below its mark | Rejected: `Order price cannot be more than 80% away from the reference price` — its `markPx` is far from the exchange's reference price (1,271 testnet pairs, many thin or junk). Pick spot pairs by volume **and** sanity-check against a reference price |
| `withdraw3` from the main wallet, 5 / 10 / 50 USDC to own address | **FAIL: `Error withdrawing from bridge`** at every amount. Faucet funds arrive as an `internalTransfer` ($1 fee), not through the bridge, so the testnet bridge may have nothing to pay out; cause not confirmed |
| `withdraw3` signed by the agent | Not a valid test (see §9) |

Takeaways:
- Orders (perp and spot), cancels, leverage and spot ↔ perp transfers work end to end.
- **Withdraw is not verified.** It can only be proven with real mainnet funds (the 4.99 USDC
  already on that account) or by finding why the testnet bridge refuses. Decision for you:
  the no-mainnet-trading rule covers trades, not a withdrawal of your own deposit, but I
  won't do it without your say-so.
- The UI must validate spot pairs before listing them; raw `spotMetaAndAssetCtxs` includes
  thousands of dead pairs.
- Open: HIP-3 dex collateral funding (`sendAsset` between dexs) is still untested.

## 11. Guards and the ETH long attempt (2026-10-02)

New safety limits (from the user): no order above **$1 notional**, no transfer to an
unverified address. Implemented in `shared/src/hl`: `placeLimitOrder` takes
`maxNotionalUsd` and throws if `price × rounded size` exceeds it; `withdrawUsd` now
requires a `verifiedDestinations` list and rejects any other address. Scripts pass
`maxNotionalUsd: 1`.

The guard caught a real bug on its first run: rounding 0.000354 ETH to 4 decimals gave
0.0004 (notional $1.13), refused. Sizing must **floor**, not round, under a cap.

ETH long (`backend/scripts/hl-eth-long.ts`, testnet, 0.0003 ETH ≈ $0.85, IOC 3% through
the mark): **not placed**. Testnet returned `Only post-only orders allowed immediately
after network upgrade`, so no taker order can fill right now; the account still has no
positions (equity 979). The testnet API also returned 502s for a few minutes. Not yet
tested: whether a ~$0.85 order passes the exchange's minimum order value (believed to be
$10, unverified).

### ETH long, filled (2026-10-02, testnet)

Approved by the user for this test only: cap raised to **$10.50** (exchange minimum is
**$10 per order**, confirmed: `Order must have minimum value of $10`; ETH size step 0.0001
≈ $0.28 makes ~$10.25 the smallest valid order). Sizing therefore rounds **up** to reach the
minimum, then the cap check applies.

| Step | Result |
|---|---|
| Agent IOC buy, 0.0037 ETH, limit 1% over mark (notional $10.25) | **Filled** at avg 2742.4, `Ioc` taker; position shows 20x cross |
| Agent reduce-only IOC sell of the same size | **Filled** at 2742.3; position closed |
| Net | Equity 979.0 → 978.990 (≈ −$0.0095: one cent of slippage/fees) |
| `userFills` read right after | Returned `[]` — the fill endpoint lagged or filters differently; not explained |

The earlier "only post-only orders allowed after network upgrade" restriction was gone on
this attempt. Leverage came up as 20x cross (the account default for ETH, not a value we
set). Open: `approveBuilderFee` + a builder-attributed fill, and HIP-3 dex collateral.

## 12. Builder-fee order and HIP-3 order, both filled (2026-10-02, testnet)

Script: `backend/scripts/hl-builder-hip3.ts` (builder fee part). Builder address = the
user's own wallet, so any fee is recoverable. All orders ≤ $10.50 notional.

| Step | Result |
|---|---|
| `approveBuilderFee`, main wallet, builder = own address, max 0.05% | **OK** |
| ETH long with `builder: {b, f: 10}` (1 bp), agent-signed, then close | **Both filled**. Raw `userFills` shows `builderFee` 0.001015 on each fill (1 bp of ~$10.15), next to the normal taker fee 0.005585. Equity moved ≈ −$0.0115 vs −$0.0095 without a builder fee |
| `sendAsset` perp → `xyz` dex, 12 USDC, `token: "USDC"`, to own address | **OK**; `xyz` account equity 12, withdrawable 12 |
| `xyz:NVDA` IOC long | Rejected: `Order could not immediately match against any resting orders` — the testnet book is empty at that price |
| `xyz:GOLD` IOC long 0.0025 (≈ $10.34) with builder fee, agent-signed | **Filled** at 4136.1 (20x cross); reduce-only IOC close **filled** at 4115.4 |
| Cost of the round trip | $12 → $11.93: ≈ $0.07, almost all spread (0.5% between best ask and bid on GOLD) |

Settled:
- Builder fees work end to end: approve once from the main wallet, attach `builder` per
  order, the agent signs, and the fill reports `builderFee`.
- A HIP-3 order works with the same agent key, no extra approval. It needs collateral moved
  into the dex first: `sendAsset({sourceDex: "", destinationDex: "xyz", token: "USDC"})`.
- Asset id `100000 + dexIndex*10000 + i` is accepted (`xyz:GOLD` traded).
- The SDK `userFills` is **oldest-first**; the earlier "empty" result was just my read
  before the fill landed, not a bug.

Practical note: testnet HIP-3 books are thin. Pick a market by checking `l2Book` depth and
spread before sending an IOC order, and price the limit off the best ask/bid, not the mark.

Still open: `withdraw3` (testnet bridge error), the WebSocket fill stream, an order from the
mobile build.
