# Hyperliquid pivot — research

Compiled 2026-10-02. Branch `hood`. Replaces the Robinhood Chain direction.
Sources are web search summaries (listed at the end), not primary-doc reads — **verify
every number marked (web) against Hyperliquid docs / on-chain before it goes in a pitch.**
Numbers from `research-track1-market-structure.md` were measured on-chain on 2026-09-15.

---

## 1. Where the base idea stands

The base idea we carried: a self-custodial, mobile-first trading app with passkey signing,
themed **bins** (one-signature baskets), and an agent proposing allocations that the user
approves. Built so far on `hood` targets Robinhood Chain Stock Tokens (Uniswap V3 swaps).

What survives the move to Hyperliquid, what does not:

| Piece | Verdict | Why |
|---|---|---|
| Expo mobile shell, Astro web, Fastify backend, pnpm monorepo | Keep | Chain-agnostic |
| Bins / basket concept | Keep, re-implement | Basket of perps or spot instead of V3 multicall; no single-tx atomic basket on HyperCore, orders are separate actions (batchable in one signed request) |
| `OpenCashDelegate.sol` (EIP-7702), Uniswap quoting, `shared/hood/*` | Drop | Hyperliquid is not an EVM swap venue; orders are signed EIP-712 messages to an exchange API |
| Passkey-derived key (WebAuthn PRF) | Rework | HL needs an Ethereum-style key for the *main wallet* and a separate **agent wallet** for trading. Privy / Turnkey passkey wallets are the proven path |
| SERV Reasoning agent / mandates / MCP | Already deleted in working tree; park | Agent-wallet model on HL fits it well later (see §4) |
| Monad contracts / architecture.md | Park | Monad-only perp factory; separate from this pivot |

## 2. The Hyperliquid ecosystem as it looks now (web)

- **HIP-3 builder-deployed perps** launched 2025-10-13; > 35% of Hyperliquid volume,
  $5–6B daily volume and $3.9B aggregate OI as of July 2026, > $25B cumulative.
  Seven of the top ten markets by volume in spring 2026 were equities or commodities.
- **One deployer dominates**: TradeXYZ (`xyz` dex), > 90% of builder-deployed OI, licensed
  S&P 500 ticker. Our own earlier teardown found Dreamcash (`cash` dex) took only 7.7% of
  a user's flow even inside its own app.
- **Deploying costs 500,000 HYPE staked** (web). That is a funded-team move, not a hackathon
  move. Do not plan to deploy a market.
- **HIP-4 outcome markets** (binary, fully collateralised) live since 2026-05-02, zero
  open fee, launching a market needs 1M HYPE staked (web). Day-one volume 6.05M contracts
  vs Polymarket 190M / Kalshi 546M.
- **Builder codes**: up to 0.1% on perps, 1% on spot; the user must approve the builder
  fee from the **main wallet** (an agent wallet cannot); max 10 active approvals per user.
  $40M+ paid out; ~40% of DAUs trade through third-party frontends.
- **HyperEVM + CoreWriter** (`0x3333…3333`): contracts can write orders/transfers into
  HyperCore; precompiles give read-only access to positions, prices, margin. This is the
  route to *onchain* products (vaults, structured baskets) as opposed to an off-chain app.
- **Gasless**: HL trading is gas-free; deposits via Bridge2 accept an EIP-2612 permit
  submitted by a relayer, so the user never needs ETH.

Builder league table (from the 2026-09-15 dossier): Phantom $20.6M @5bps, Based $15.1M
@2.5bps, PVP $7.9M, MetaMask $6.5M @10bps, Insilico $3.3M, Axiom $2.3M @1bp, Dreamcash
$2.6M @4.5bps. Frontends compete to zero fee; wallets and venue owners don't.

## 3. Crowded vs open ground

Crowded: generic "Hyperliquid mobile terminal" — Phantom, MetaMask, Based, Liquid,
Dreamcash, official Android app, and an open-source Expo builder app (`HyperTrade`,
Privy + agent signing + relayer + builder fees) already exist. Building a plain
passkey perp terminal is a reskin.

Where the evidence points to a gap:

1. **Taker-only mobile UX costs users money.** Measured: 72 of 74 fills taker; 4.5 bps
   taker + 4.5 bps builder turned −$27.54 gross into −$48.46 on a $125 account.
   Limit / post-only / TWAP as the *default* is a demonstrable, cheap edge.
2. **Themed baskets across HIP-3 equity/commodity perps and spot.** Seven of the top ten
   markets are now non-crypto, yet every frontend is one-symbol-at-a-time. Our existing
   bins concept ("pool several, enter once") maps directly. Unverified that users want it.
3. **Withdrawal safety.** `withdraw3` takes an arbitrary destination, so one compromised
   main-key signature drains the account. A withdrawal allowlist/timelock is an
   unoccupied differentiator for a self-custodial frontend.
4. **Agent wallets as a first-class feature.** HL agent keys can trade but cannot
   withdraw, and builder-fee approval can be bounded. That makes "an agent proposes, you
   approve, key can never move funds" a *protocol-enforced* property here, not a promise.
   This is the strongest fit for the SERV Reasoning work already done.

## 4. Candidate products (hypotheses, not decisions)

| # | Product | User / job | Revenue | Main risk |
|---|---|---|---|---|
| A | **Bins on Hyperliquid** — themed baskets of HIP-3 equity/commodity perps + spot, limit-first execution, one approval | Retail wanting a thematic view without 6 tickets | Builder fee (≤ 0.1% perps) | Others copy easily; basket execution is N orders, partial fills |
| B | **Agent-managed account** — plain-English mandate, agent trades via a no-withdraw agent wallet, user approves or sets bounds | Busy trader who wants a rule, not a screen | Builder fee on agent flow | Regulatory framing; agent losses; needs track record |
| C | **Onchain basket vault on HyperEVM via CoreWriter** — tokenised basket whose contract trades HyperCore | DeFi users wanting a composable position | Vault fee | Contract risk; CoreWriter latency/limits unverified |
| D | **HIP-4 outcome-market frontend** | Prediction-market users | Builder fee on outcomes (needs check it applies) | Tiny volume vs Polymarket; builder-fee applicability unverified |

**Decision 2026-10-02:** agent work (B) is dropped for now. The product is **A** —
leverage and bins on Hyperliquid, phone and web only — with limit-first execution as the
UX proof. C is the long-term moat but is a research project; D is weak.

## 4b. What a bin is (clarified 2026-10-02)

A bin is an **algorithmic, fund-like product**: a basket of assets that move together by
trend (AI, defence, gold-and-miners) or by narrative (copy-trading a politician's
disclosed trades), that the user holds like a SIP or mutual fund — recurring buys,
rebalancing to target weights — not a one-time multi-leg order. Two bin types:

- **Trend bins**: rules-based membership and weights (momentum, sector, market-cap).
- **Narrative / copy bins**: weights follow a public disclosure feed.

Consequences to resolve (not yet researched): (1) copy bins on US-politician trades are
fed by STOCK Act filings, which arrive up to ~45 days late, so they replicate *what was
held*, not *what is happening* — must be labelled as such; (2) many disclosed names will
have no Hyperliquid market, so a copy bin only covers the subset listed on `xyz`/`cash`/
spot; (3) perps pay or charge funding continuously, so a long-hold SIP on leveraged perps
bleeds or earns funding and can liquidate — leverage and "SIP" pull in opposite
directions and need an explicit rule (e.g. low default leverage, per-bin liquidation
buffer, auto top-up); (4) rebalancing and SIP buys are scheduled orders, which need
something running between user sessions — which sits in tension with dropping the agent
and server-side keys (an agent wallet is exactly how a scheduled buy would sign).

**Decision 2026-10-02:** SIP is dropped entirely — no recurring buys, no scheduler, so
point (4) above disappears. Leverage stays. Bins are driven by **live data from real
sources**; entry and rebalance are user-triggered.

## 4c. Bins are defined by institutions and large traders (2026-10-02)

Decision: a bin is **defined by an institution or large trader whose trade execution is
public** — the bin mirrors their live Hyperliquid positions, scaled to the user's size and
leverage. This replaces the STOCK-Act/Pelosi idea, whose data is ~45 days stale.

Why it fits: Hyperliquid is fully on-chain, so any address's open positions, fills and
margin are public and live. The documented info endpoint exposes `clearinghouseState`
(positions + margin summary, optional `dex` param, so `xyz`/`cash` positions are
readable), `userFunding` and `userNonFundingLedgerUpdates`. Fills, vault details and
leaderboard were **not** on the docs page I fetched — they likely exist elsewhere; verify.
Third-party trackers (HyperTracker, ranking 1.6M+ wallets, with vault leaderboards)
already prove the data is usable, and Hyperliquid has no native copy trading (web).

Open issues, none resolved:
1. **Who counts as an institution?** Public addresses are pseudonymous. A bin labelled with
   a real-world name needs a verified address-to-entity mapping; mislabelling is a legal
   and trust risk. Candidates: protocol vaults (HLP), disclosed fund/market-maker
   addresses, leaderboard top traders, user-submitted addresses.
2. **Consent.** Public data does not mean the trader agreed to be copied; large traders
   can be front-run when followers mirror them (and may hide via multiple wallets).
3. **Scaling and leverage.** Mirror weights as % of equity, apply the user's chosen
   leverage cap; a whale's leverage and margin mode may be unsafe for a small account.
4. **Latency and slippage.** Followers fill after the leader; thin HIP-3 markets will show
   it. Show the leader's entry vs the user's expected fill.
5. **Unsupported positions.** Mirror only what the user can trade; surface what was skipped.
6. **Rebalance.** Detect leader changes live, show a diff, user taps to apply (no automation).

### 4d. Decisions and live pulls (2026-10-02)

Decisions: first bins come from **protocol vaults (HLP), vault and leaderboard top
traders, and disclosed market-maker addresses**. Leverage cap depends on the **amount the
user deposits and their tier**. Slippage: **ask the user via notification each time a
mirrored position is about to be swapped** (tap to approve; no auto-execution).

Live pulls from the public API (`api.hyperliquid.xyz/info`, `stats-data.hyperliquid.xyz`),
read-only, no key:

| Check | Result |
|---|---|
| `vaultDetails` on HLP parent | Works. $43.5M equity, 4.1% APR, `relationship.type = parent` with **7 child addresses**; parent's own `clearinghouseState` has **0 positions** |
| HLP children | Two strategy vaults hold **177 perp positions each** ($3.0–3.2M equity, largest legs ~$70–80K, e.g. WIF/SAND/BNB, opposite signs across the two). It is a **market-making inventory book, not a thesis** — a poor thing to mirror as a "bin" |
| Leaderboard | 47,033 rows, single 38MB GET; fields `ethAddress, accountValue, windowPerformances (day/week/month/allTime: pnl, roi, vlm), displayName`. **`displayName` was null on every row I checked** — no names, so no institution labelling from this feed |
| Top by account value / 30d PnL | The 6 biggest accounts ($270M–$3.4B equity, up to $725M 30d PnL) have **0 perp positions** on main and `xyz` — probably spot/HYPE holders or custody-type wallets. Ranking by equity or PnL alone surfaces **wallets that cannot be mirrored as perp bins** |
| Mirror-able traders | Filtering to accounts with live perp positions found e.g. one with 37 main + 3 `xyz` positions (PUMP, GRAM, LTC at 5–10x) and one with 8 positions (NEAR/SOL/ADA at 10x). `clearinghouseState` with `dex:"xyz"` does return equity-perp positions |
| `userFills` | Returned empty for an account with no activity; not yet tested on an active one |
| `perpDexs` | Lists 10 builder dexs: `xyz, flx, vntl, hyna, km, abcd, cash, para, mkts, io` |

Implications:
- Leaderboard ranking must be filtered to **accounts with open mirror-able perp positions
  and sane leverage**, then ranked by risk-adjusted performance, not raw PnL or equity.
- HLP is useful as a *reference* (market-maker inventory, sentiment) but not as a bin.
- "Institutions" will need our own curated address list — the leaderboard gives none.
- The bin definition therefore needs a **curation layer** (address, label, evidence of
  identity, last verified) and an eligibility filter (min history, max leverage, active).

Follow-up tests (2026-10-02):

| Test | Result |
|---|---|
| Polling `clearinghouseState` for 150 addresses, sequential | 150/150 HTTP 200 in 46s (~0.3s each); **no rate limiting at that pace**. Limits at higher rates not tested |
| Shortlist filter (equity $1M–$5B, 30d PnL > $200K, all-time PnL > $1M, top 150 by 30d ROI, then live positions, leverage ≤ 10x, ≤ 40 positions) | **107 of 150** passed. Top ones: $5–19M equity, 1–15 positions, 2–9x effective leverage |
| `userFills` on an active account | Returns **2,000 fills** (the cap), each with `dir` (Open Long…), `startPosition`, `crossed` (maker/taker), `closedPnl`, `fee`, `twapId`. Enough to reconstruct a leader's entries |
| WebSocket `userFills` subscription | Subscribes in ~0.7s and returns a snapshot (`isSnapshot`); **no live fill arrived in 12s**, so live latency is untested (account may have been quiet) |
| WebSocket `webData2` subscription | Returned an `error` — wrong subscription shape or type for this use; not investigated |

Caveats on the shortlist: it ranks by recent ROI, so many entries are **single concentrated
positions** (several have n=1) — likely hot streaks, not durable skill. A real eligibility
rule needs a longer track record, drawdown, and position-count/diversification limits
before a trader earns a bin. Survivorship bias applies to any leaderboard.

Not yet verified: live fill latency on an active leader, `webData2` / correct stream for
position changes, rate limits at scale, non-HLP vault leader positions.

## 5. Implementation shape for A + B (sketch)

- **Auth**: Privy or Turnkey passkey wallet → main wallet; app creates an **agent wallet**
  (`approveAgent`) for order signing; user signs `approveBuilderFee` once.
- **Backend**: Fastify keeps a per-user agent key only if the agent runs server-side;
  otherwise orders are signed on device. Reads via the public info API / WebSocket.
- **Orders**: `/exchange` actions signed EIP-712; a bin entry = batched order action,
  limit-first with a fallback timer.
- **Market data**: `meta` / `metaAndAssetCtxs` per dex (`xyz`, `cash`, main), tick rule
  (≤ 5 sig figs and ≤ 6 − szDecimals decimals for perps) enforced client-side.
- **Deposits**: Bridge2 `batchedDepositWithPermit` through our relayer for the gasless path.

## 6. Open questions to settle before building

1. Does a bin need to be atomic? HyperCore has no multi-asset atomic fill — what does a
   partial fill look like to the user?
2. Which collateral: USDC main book vs USDT0 (`cash`) vs `xyz`'s collateral — each dex has
   its own, so a cross-dex bin may need collateral transfers. Not verified.
3. Do builder fees apply to HIP-3 dex orders and HIP-4 outcomes? (Dreamcash's measured
   fills say yes for `xyz` and `cash`; HIP-4 unchecked.)
4. Is a server-held agent key acceptable for the trust story, or must signing be on-device?
5. Does the user want the hackathon track (Metropolis closes 2026-10-13, Monad) or is the
   Hyperliquid app independent of it? Memory says "Monad only for now"; this pivot
   contradicts it unless they are separate tracks.
6. Regulatory framing for an agent that trades equity-tracking perps for retail.

## Sources (web search, unverified against primary docs)

- [Dwellir — Builder codes](https://www.dwellir.com/blog/hyperliquid-builder-codes)
- [CoinGecko — HIP-3 & HIP-4](https://www.coingecko.com/learn/hyperliquid-hip3-hip4-tokenized-stocks-and-prediction-markets)
- [TradingView/Cointelegraph — HIP-3 OI](https://www.tradingview.com/news/cointelegraph:af9bda3f5094b:0-hyperliquid-hip-3-open-interest-hits-793m-on-commodities-surge/)
- [Talos — State of the Network 368](https://www.talos.com/insights/state-of-the-network-368)
- [Chainstack — HIP-4 outcome markets](https://docs.chainstack.com/docs/hyperliquid-hip4-outcome-markets-trading)
- [Forklog — HIP-4 launch](https://forklog.com/en/hyperliquid-launches-prediction-markets/)
- [Dwellir — approveBuilderFee](https://www.dwellir.com/docs/hyperliquid/approveBuilderFee)
- [Chainstack — precompiles & CoreWriter](https://chainstack.com/hyperliquid-hyperevm-precompiles-corewriter-bridge/)
- [HyperTrade (open-source Expo builder app)](https://github.com/LWL-HyperTrade/hypertrade)
- [Privy — Liquid](https://privy.io/blog/redefining-mobile-trading-with-liquid)
