# Track 1 research — market structure on Monad

Compiled 2026-09-14 for the Metropolis hackathon (submissions close Oct 13, 2026).
Source for the resource list: [`metropolis-hackathon-resources.md`](./metropolis-hackathon-resources.md).

---

## 1. The Dreamcash teardown (the comp that set our direction)

Dreamcash is a self-custodial mobile-first trading app on Hyperliquid — iOS, Android,
web, macOS. Developer listed as Supreme Liquid Labs; built by the Beam Foundation team
(ex-Merit Circle), founder handle `meritcirclorr`. 100k+ Play installs, App Store 4.2★
from ~40 ratings, 97MB, iOS 16.4+, 18+. $10 minimum. Card / Apple Pay / Google Pay
onramps, daily AI market signals, XP seasons and referrals. Leverage listed as **40x on
the site, 50x in the App Store description** — unreconciled.

### How it actually makes money

**Corrected 2026-09-15 against a live Dreamcash account's full fill history
(`0x185a0bcf…3ca1`, 74 fills, 2026-02-25 → 2026-08-26). The "0% builder fee" claim below
was wrong and it was load-bearing — see the measured numbers.**

It charges a **flat 4.500 bps builder fee** (`f: 45`, against HIP-3's 10 bps perp cap) on
**70 of 74 fills** — min, max and median all exactly 4.500. Not zero, and never zero
across six months of fills. DefiLlama's API (the page 403s, the API does not) reports
**$3.55M all-time fees / $2.62M all-time revenue**, under three linked entities:
*Dreamcash*, *Dreamcash Interface*, *Dreamcash Markets*.

So it monetises on **both** legs, not one: it owns the venue (its own HIP-3 perp DEX
"CASH", USDT0-quoted, 50% of fees on markets it deployed) **and** it clips a builder fee
on every order it routes — including orders it routes to Hyperliquid's *main* book, which
it does not own.

**The split is the finding.** On that account, 82% of routed volume went to the main
Hyperliquid book, not to CASH:

| Book | Volume | Share | Dreamcash earned |
|---|---:|---:|---:|
| HyperCore perps (main) | $20,733 | 82.3% | $9.33 |
| `xyz` DEX (not theirs) | $2,390 | 9.5% | $0.97 |
| **`cash` DEX (theirs)** | **$1,930** | **7.7%** | **$0.87** |
| HyperCore spot | $128 | 0.5% | $0.04 |

n=1 account, so directional not statistical — but it inverts the tidy story. The venue is
the *margin* play; the builder code is the *volume* play, and volume is overwhelmingly
someone else's book. A venue-only reading of Dreamcash would have us build the hard half
first.

- **17 markets as of 2026-09-15** (not 10), read from `meta(dex="cash")`: USA500, TSLA,
  NVDA, HOOD, GOOGL, INTC, AMZN, MSFT, META, GOLD, SILVER, EWY, KWEB at **20x**, WTI and
  CAR at **10x**, and — note — **BTC and ETH at 40x**. It added crypto majors to its own
  venue, competing with the main book it also routes to. Deployer
  `0xffa8198c…deef7`, fee recipient `0xaa7f0d3d…c8bb4`.
- Resolves the 40x/50x discrepancy: **40x is the real ceiling**, and only on BTC/ETH. No
  market on the CASH dex supports 50x.
- **Tether invested (Feb 2026)**, amount undisclosed, and funds a **$200,000/week**
  incentive programme for CASH markets paid on share of USDT volume.
- **Selini Capital was the liquidity provider.** Even a venue that owns its markets had
  to hire a professional LP. Owning the market gets you the economics, not the depth.
- Their own framing of the wedge: *"Until now, there has been no way for the millions of
  traders holding USDT to access Hyperliquid markets directly."* The wedge was the
  **collateral asset**, not the tickers — HIP-3 lets the deployer pick the quote asset.
- ~~It later retired the USDT-quoted CASH market~~ — **false as of 2026-09-15**. The
  CASH dex is live and still USDT0-quoted: `collateralToken: 268`. The collateral wedge
  has *not* decayed. (The broader caution still stands on its own: a quote-asset wedge is
  a decaying asset even if this one hasn't decayed yet.)

### The league table it sits in

Hyperliquid builder codes: $40M+ paid out, ~40% of DAUs trade via third-party frontends.

| Builder | Revenue | Fee | Users | Position |
|---|---|---|---|---|
| Phantom | $20.6M | 0.05% | 137,496 | owns distribution (wallet), $150 ARPU |
| Based | $15.1M | 0.025% | 42,579 | $44B volume, throughput strategy |
| PVP | $7.9M | — | — | oldest builder, since Jun 2024 |
| MetaMask | $6.5M | 0.1% | 43,761 | highest fee, brand |
| Insilico | $3.3M | — | 2,962 | $1,116 ARPU, whales |
| Axiom | $2.3M | 0.01% | — | $22.1B volume, thin margin |
| **Dreamcash** | **$2.6M** | **0.045%** | — | **owns its markets *and* clips routed flow** |

**Conclusion:** frontends race to zero (Axiom traded $22.1B for $2.3M). Market owners and
distribution owners do not. Dreamcash is not the 0%-fee outlier the earlier draft made it
— at 4.5 bps it sits just under Phantom (5 bps) and well above Based (2.5) and Axiom (1).
It is mid-table on fee *and* owns a venue. The lesson is "do both", not "skip the fee".

### Mechanics verified on-chain (what to copy, what to avoid)

All confirmed 2026-09-15 by reading the account's Arbitrum and HyperCore history directly.

**1. Gasless onboarding is the real UX moat — and it's one call.**
The trading address has **nonce 0 on Arbitrum**. It has never signed a transaction. Both
deposits entered via Hyperliquid's Bridge2 (`0x2Df1c51E…63dF7`):

```
selector 0xb30b5bce
  batchedDepositWithPermit((address,uint64,uint64,(uint256,uint256,uint8))[])
```

User signs an **EIP-2612 permit** off-chain; a relayer submits and pays gas. Two distinct
relayer EOAs observed. The user never holds ETH, never sees a gas prompt, never bridges
manually. *Monad equivalent:* permit + relayer, or 7702 session keys — pairs directly with
the passkey plan in `decisions.md`. This is the single highest-leverage thing to clone.

**2. The custody story that makes self-custody true.**
Hyperliquid agent/API wallets **can trade but cannot withdraw or transfer**. Withdrawal
requires a main-wallet signature. That one asymmetry is what lets a hosted frontend hold
order-signing rights without holding funds. **Build this constraint into the market
factory from day one** — it is the difference between "self-custodial" as a claim and as
a property.

**3. Withdrawal destination is arbitrary — design decision, and a risk.**
`withdraw3` takes an explicit destination; both withdrawals went to *different* addresses
than the trading account (read from Bridge2's `RequestedWithdrawal`, topic
`0xcc10abf5…`, user indexed). Flexible, but it means a compromised main key exfiltrates in
one signature. Consider a withdrawal allowlist or timelock as a differentiator.

**4. Tick rule — a spec detail the market factory must expose.**
Verified empirically across all 74 fills, every market maxing at exactly 5 sig figs:

> price must satisfy **both**: ≤ **5 significant figures**, and
> ≤ **(MAX_DECIMALS − szDecimals)** decimals. MAX_DECIMALS = 6 perps, 8 spot.
> Integers always allowed. Size lot = `10^−szDecimals`.

Tick therefore *floats with price magnitude* rather than being fixed per market. A
deployer picks `szDecimals` and implicitly picks both tick and lot. Our factory needs the
same single knob, or listers will misconfigure it.

**5. The anti-pattern: taker-only.**
**72 of 74 fills were takers.** No post-only, no resting orders. The user paid 4.5 bps
taker *plus* 4.5 bps builder on nearly every fill, turning a −$27.54 gross trading result
into **−$48.46** on a $125 account. Mobile perp apps optimise for one-tap market orders
and that is where the user's money goes. **A mobile app that makes limit/post-only the
default is a genuine, demonstrable edge** — and it costs us nothing to build.

### What this does to our own thesis

The `decisions.md` assumption *"a vault, not a CLOB — Dreamcash still needed Selini plus
$200K/week"* gets **stronger**, not weaker. The new evidence: even with a paid LP and
Tether's incentive budget, Dreamcash's own venue captured **7.7%** of this user's flow
while 82% went to the incumbent book. A new venue struggles to win even its own app's
users. Plan for seeded-vault depth and small OI caps, and do not model the venue as the
near-term revenue line — model the routed builder fee as the revenue line and the venue as
the long-term margin.

---

## 2. The primitive — HIP-3, and what a Monad version would copy

Hyperliquid's builder-deployed perpetuals spec:

- Deployer stakes **500k HYPE**, held ≥183 days ("expected to decrease over time").
- Deployer controls: oracle sources and contract spec, oracle pricing, leverage limits,
  collateral/quote asset, and a **0–300% deployer fee share** (above 100%, protocol fee
  is redirected to the deployer).
- First **3 assets free** per dex; further assets via Dutch auction on HIP-1
  hyperparameters, plus `7 + 0.2 * n` reserve deployments at current auction price.
- **Slashing** by stake-weighted validator vote: up to 100% for invalid state transitions
  or prolonged downtime, 50% for brief downtime, 20% for degradation. Slashed stake is
  **burned**, not redistributed.
- `haltTrading` cancels all orders and settles positions at mark, and can resume —
  contracts are recyclable without re-auction.
- Cross-margin on an asset is **irreversible**; assets moving >50% daily more than
  monthly are ineligible and slashable.

Adoption: HIP-3 open interest ~$790M (Jan 2026) → $1.4B (Mar) → $3B+ (Jun). TradeXYZ
dominates equity/commodity deployments.

**Monad has no analogue.** No venue found offering permissionless market deployment —
see Open questions.

---

## 2b. Perpl teardown — settled from official sources (2026-09-15)

Read from `docs.perpl.xyz`, `github.com/PerplFoundation/{api-docs,perpl-docs,dex-sdk}`,
and the live `GET https://app.perpl.xyz/api/v1/pub/context`.

### Listing is NOT permissionless — the wedge survives

Six independent pieces of evidence:

1. **8 markets, all crypto**: BTC, MON, ETH, SOL, HYPE, ZEC, LIT, PUMP. No equities, no
   metals, no FX, no commodities.
2. **No market-creation endpoint.** The REST surface is market-data reads, trading,
   profile and API-key enrollment. Nothing writes a market.
3. **No listing documentation anywhere.** A keyword sweep for *permissionless / market
   creation / deploy / factory / governance / whitelist* across the whole `perpl-docs`
   set returned **zero hits**.
4. **One `instance`** (`id: 1`, `0x34b6552d…12a6f`). Markets carry `instance_id`, so the
   schema *anticipates* multiple exchange instances — the HIP-3 shape — but only the
   operator's exists and there is no path to create one.
5. **One collateral token** (AUSD). HIP-3's deployer-picks-the-quote-asset knob has no
   analogue here.
6. **Even builder codes are gated.** *"Builder codes are issued by the operator; there is
   no self-service endpoint."* Applications go through a **Google Form**
   (`features.builderApplyUrl` in the live context). Builder id is a `uint8`, `1..255` —
   *"the registry is deliberately small."*

**Conclusion: our primitive is still unbuilt on Monad.** Perpl is a curated venue, not a
factory.

### What Perpl already occupies — two corrections to our plan

- **AUSD is not an open wedge.** Perpl's *entire exchange* settles in AUSD
  (`PERPL_COLLATERAL_TOKEN = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`), and the PLP
  vault takes AUSD deposits. "Be the AUSD venue" is **taken**. The Agora bounty is still
  winnable, but on *what we do with* AUSD, not on being first to it.
- **The real gap is RWA.** Perpl lists zero equities, metals or FX. Bean is the Monad
  venue that does (50x) — so §9 Q2 (Bean's listing model) is now the load-bearing one,
  not Q3.

### Mechanics that port from our Dreamcash teardown

| Property | Hyperliquid | Perpl | For us |
|---|---|---|---|
| Key can withdraw? | agent wallet: **no** | API key: **never, any scope** | Same invariant. Adopt it. |
| Key auth | EIP-712 agent approval | **Ed25519** keypair, EIP-712 enrollment, PoP | Perpl's is cleaner |
| Builder fee cap | 10 bps (`f:45` observed) | **10 bps** (`per_100k`, max `100`) | Identical ceiling |
| Builder onboarding | permissionless | **operator-approved, Google Form** | ⚠️ lead time |
| Fee charged | open **and** close | **open only** (T1 taker 6.9 bps, maker 0.9) | Perpl cheaper round-trip: 6.9 vs 9 |
| Tick | `min(5 sig figs, 6−szDecimals)` | explicit `price_decimals` / `size_decimals` | Perpl's is the better factory knob |
| Margin | cross + isolated | **isolated only, to begin with** | Cross is a differentiator |
| Delegation | agent wallets | on-chain `delegated-account` (Solidity repo) | Read before designing ours |

### Operational facts worth knowing

- **Beta** (`mainLogoLabel: "Beta"`), max account equity **$1M**, min account open and min
  deposit **$10**, min withdrawal $0.01, max 16 trigger orders per account.
- **Geo-blocked: US, GB, RU, UA, BY, CU, IR, KP, SY.** The US *and UK* blocks matter for
  how we pitch and demo.
- BTC market config: `price_decimals 1`, `size_decimals 5`, funding every **2580s** (43
  min, not the hourly the docs claim), `order_ttl_blocks 20` (~6s at 300ms) with
  `order_retry_blocks 22`. Short-lived orders plus a **recycle fee** paid to whoever
  clears an expired order — a Monad-native design we should copy for keeper economics.
- Raw `initial_margin 1500` / `maintenance_margin 2500` — unit encoding not documented in
  what was read; do not infer max leverage from these without checking the SDK.
- PLP vault: ERC-4626, AUSD, **7-day withdrawal delay**, weekly fee distribution, curator
  may run strategies off-chain, hedges via **Fireblocks OES** to CEXs. A real comp for our
  seeded vault — note even Perpl's vault hedges *off* the venue.

### Action with a deadline

Builder-code approval is **operator-gated with unknown lead time** and submissions close
**Oct 13**. If routing through Perpl is on the critical path, **submit the builder form
now** — attribution-only (`max_builder_fee_per_100k: 0`) is a valid enrollment, so it
costs nothing to hold a code we may not charge on.

---

## 2c. Testnet & sandbox path — verified by probing, 2026-09-15

Everything below was confirmed by hitting the live endpoints, not read from docs.

### Three tiers

| Tier | What | Config |
|---|---|---|
| **Local** | Custom **Monad `anvil`** — `category-labs/foundry` `v1.5.0-monad.0.2.0`. Required by `dex-sdk` (Rust ≥ 1.85) | contract work, no network |
| **Testnet** | Monad testnet + Perpl testnet | chain `10143`, REST `https://testnet.perpl.xyz/api`, WS `wss://testnet.perpl.xyz`, RPC `https://testnet-rpc.monad.xyz`, AUSD `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` (6 dec), instance `12` @ `0x1964c32f…80cc` |
| **Mainnet** | chain `143`, REST `https://app.perpl.xyz/api`, RPC `https://rpc.monad.xyz`, AUSD `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, instance `1` | last |

### Testnet is live and busier than mainnet

BTC 1h candles, both environments, same hour: **testnet ~270–295 trades/hr** vs
**mainnet ~82**. The testnet book is actively made — there is real flow to trade against,
which makes it a usable demo venue, not a ghost town.

### Gotchas found by probing (each cost a request to discover)

1. **`public_key` must be `0x`-prefixed.** Bare hex returns **HTTP 500 Internal Server
   Error**, not a 400. Five different malformed probes all returned an identical 500 —
   the error says nothing. Budget debugging time; this is a server-side bug.
2. **`Origin` must be whitelisted by Perpl.** Only `https://testnet.perpl.xyz` returned
   `200`; `https://your-app.example` and `https://example.com` both returned `400`.
   **Programmatic key enrollment from our own origin is a second operator gate**, separate
   from builder codes.
3. **Market IDs differ per environment.** BTC is `1` on mainnet, **`16` on testnet**.
   Never hardcode — read `GET /v1/pub/context`.
4. **Candles: resolution in _seconds_, timestamps in _milliseconds_.** Max 1024 per
   request. Mixing the units returns `400 Bad Request` with no detail.
5. **Testnet fees are half mainnet**: maker `45` / taker `345` micros (0.45 / 3.45 bps) vs
   `90` / `690`. Do not benchmark economics on testnet numbers.
6. `price_decimals` / `size_decimals` vary sharply per market — BTC `1`/`5`, MON `5`/`0`,
   PUMP `6`/`0`. Any UI or factory must read them per market.

### Builder codes *do* work on testnet — this is the unblock

Probed against testnet `POST /v1/api-key/payload`:

| Probe | Result |
|---|---|
| plain key, `0x` pubkey, whitelisted origin | **200** — payload returned |
| `builder_id: 1`, `max_builder_fee_per_100k: 100` | **200** — builder-bound enrollment works |
| `builder_id: 1`, ceiling `99999` (over cap) | `400` — ceiling enforced |
| fee ceiling with no `builder_id` | `400` — matches documented error table |

So **the entire builder-code flow is developable on testnet today**, without waiting on
mainnet operator approval. Testnet builder codes are requested via **Discord**
(`features.builderApplyUrl` = `https://discord.gg/perpl`), not the mainnet Google Form.

### The path that needs no approval at all

Perpl's own docs: *"End users can create a key themselves from the web UI
(`/apikeys`) and paste the token into your app."*

That path needs **no origin whitelisting and no builder code**. It is the de-risked
route to a working demo by Oct 13:

1. Build against user-pasted API keys → demo works regardless of Perpl's response time.
2. Request testnet builder code on Discord → prove the fee-attribution flow end to end.
3. Submit the mainnet builder form in parallel → upside if it lands before submission.

Sequenced this way, **no Perpl approval is on the critical path.**

### Still unverified

- Testnet AUSD **faucet** — not yet located. Blocks any actual order placement; find it
  before writing trading code.
- Order placement itself untested (needs a funded testnet account + enrolled key).
- `geo_block` lists **US and GB** on both environments. Public market-data reads worked
  fine from here, so it appears frontend-level — but confirm before relying on it for a
  live demo.

---

## 3. Monad execution facts that change engineering

| Fact | Consequence |
|---|---|
| 10k TPS, **300ms blocks / 600ms deterministic finality** (upgraded from 400/800) | Per-block funding and mark updates; UI need never show a pending state |
| **No global mempool** — txs forwarded to the next few leaders | Order flow is private by default; keepers must target leaders |
| Leader orders by **descending fee-per-gas — a priority gas auction** | MEV taxes are implementable here; liquidation is already an auction |
| Gas charged on **gas limit, not gas used** | Tight per-action limits; keeper cost budgeted on limit |
| **Reserve balance** — txs can revert at execution despite inclusion | "Included but reverted" is a real UI state |
| Storage warmed per **128-slot page**; optimistic parallel execution | Pack per-market structs; no shared hot global slots or parallelism is lost |
| Chain IDs **143** mainnet / **10143** testnet | — |
| 170+ validators, 30+ countries, zero downtime since Nov 2025 launch, 130M+ txs | — |

Architecture: MonadBFT (pipelined, linear message complexity, tail-forking resistant),
RaptorCast propagation, asynchronous execution (order first, execute after), optimistic
parallel EVM, MonadDB.

---

## 4. Oracles — the enabling fact for tokenized stocks

Live on Monad (addresses in `monad-crypto/protocols/mainnet/*.jsonc`):

| Provider | Type | Latency |
|---|---|---|
| Pyth | pull + Entropy VRF | 400ms cadence |
| Switchboard | pull, VRF, aggregator | "Surge" sub-10ms — `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67` |
| Stork | pull | sub-second |
| Chainlink | push Price Feeds + pull Data Streams | low-latency |
| Chronicle | push, custom | 60–80% lower gas per update |
| RedStone | push + pull | — |
| Supra | push, pull, dVRF | — |

**Pyth Indices (launched Jun 2026)** give **24/7 pricing for US equities, metals and
oil** — 125+ first-party publishers, exclusive Blue Ocean ATS collaboration for 24/5
equities, already consumed by Coinbase, Kraken, dYdX, Nado and Polymarket. Weekend mark
pricing for a TSLA or gold perp used to force venues to build internal logic. It doesn't
any more. This is what makes the tokenized-stock leg buildable in four weeks.

---

## 5. Liquidity map on Monad

| Layer | Live |
|---|---|
| Onchain CLOB (spot) | **Kuru** (Paradigm-led $13.6M; hybrid CLOB+AMM; constant low gas per limit order; Python/Rust SDK; WS executor; `MarginAccount`; Kuru Flow aggregator), Clober, Capricorn |
| Onchain CLOB (perps) | **Perpl** (~$1.2B/mo; 1,000 post-and-cancel/sec; **~$0.0001 per MM order**; REST + WS; Ed25519-signed API keys; Rust SDK; sub-accounts; Builder Codes) |
| Other perps | **Bean** (oil, gold, stocks, FX, crypto, 50x), **LeverUp** (LP-free, 1001x, LVUSD, uncapped OI), Drake, Monday Trade |
| AMM | **Uniswap v4 with hooks live** (Doppler, aeon.fun, Fuze in Uniswap's hooklist), Pancake, Curve, Balancer, Sushi |
| Aggregation | Monorail, 1inch, Matcha, Dirol, 0x |
| Lending (Jul 2026 TVL) | Aave V3.7 **$250M** (12 assets, $15M incentives, 10M GHO seeded, >$100M in 48h), Euler **$175M**, Morpho **$115M**, Curvance **$90M** (single-tx leveraged positions from interest-bearing collateral) |
| LSTs / yield collateral | aPriori sMON, Kintsu, Magma, FastLane **shMON** (staking + MEV + Chainlink SVR liquidation recapture) |
| Stables | USDC day-one ($410M+), USDT0, Agora **AUSD**, GHO; 20+ fiat ramps (Zerohash, Bidali) |
| Execution abstraction | **FastLane Atlas** live on Monad (`FastLane-Labs/atlas-on-monad`) — OFA / MEV-capture rail |

Network: ~$1B DeFi TVL, ~$774M stablecoins, ~$936M weekly perp volume. Also live:
Mento (onchain FX, 15 currencies, $18.5B 2025 volume), Valos (institutional credit,
$200M capacity vault on AUSD).

---

## 6. Counterparty and risk — what the vault model must survive

HLP / GLP / JLP: a protocol vault is counterparty and liquidator for every listed perp.
It is how a brand-new market gets depth on day zero — a CLOB gives a new listing an empty
book.

**The cautionary data point:** a trader used offsetting positions to force a liquidation
that put HLP **$12–13.5M underwater**. Mitigations that are therefore load-bearing, not
polish: per-market isolation, OI caps sized by deployer stake, skew-based funding,
price impact priced off the market's own OI, and oracle staleness/confidence guards with
a reduce-only fallback.

---

## 7. Primitive landscape (what else is unbuilt)

Ranked by how open the lane looks:

1. **Permissionless market deployment** — the HIP-3 analogue. Chosen direction.
2. **MEV taxes on a priority-ordered L1** — Paradigm's
   [Priority Is All You Need](https://www.paradigm.xyz/2024/06/priority-is-all-you-need).
   A contract charging `k * priorityFeePerGas` captures its own MEV and can rebate it.
   Requires priority ordering + censorship resistance + pre-tx privacy + no last look.
   **Monad satisfies the ordering leg.** Nobody has shipped it here.
3. **Funding-rate as a traded market** — Delphi calls it the next stage. Sobering prior:
   Voltz sunset, IPOR at low-single-digit-millions TVL; Pendle won the rate market by
   *not* being a swap.
4. **LP-range leverage / perpetual options** — InfinityPools (borrow Uniswap v3/v4
   ranges; leverage set by tick proximity; no liquidations, no oracles, no counterparty),
   [Panoptic](https://arxiv.org/pdf/2204.14232) (perpetual options from LP positions,
   no strikes or expiry), power perps / Squeeth. Most novel, heaviest math.

Market-design background consulted: [am-AMM](https://arxiv.org/pdf/2403.03367) (Harberger
lease over pool management), [LVR](https://arxiv.org/pdf/2208.06046),
[FM-AMM batch trading](https://arxiv.org/pdf/2307.02074), Paradigm's
[Orbital](https://www.paradigm.xyz/2025/06/orbital) (n-asset concentrated liquidity) and
[Opportunity Markets](https://www.paradigm.xyz/2025/08/opportunity-markets).

---

## 8. Market context

- Tokenized equities ~**$2.5B** onchain (Aug 2026): Ondo ~$957M (>70% issuer share),
  Binance bStock $622M, xStocks $600M — **none on Monad yet**, so equity *perps*
  (synthetic, oracle-settled) are the realistic path, not spot tokenized stock.
- Perp DEX share 2.1% (Jan 2023) → 11.7% (Nov 2025); 2025 perp DEX volume $12.09T.
  Delphi: perp DEXs absorbing the TradFi stack.
- Mobile ~36% of Solana spot volume, up from 28%.
- **Regulatory**: CFTC approved the first US-listed perpetual future (cash-settled BTC)
  in May 2026; equity perps remain geofenced from US persons. Oracle-settled synthetics
  convey no share ownership — geoblock, and say so plainly.

---

## 9. Open questions — unverified, and load-bearing

1. **Does any Monad venue already offer permissionless market deployment?** The whole
   direction rests on "no". **Perpl: settled — NO (2026-09-15, see §2b). Bean, LeverUp,
   Drake, Monday Trade still unchecked.**
2. **Bean Exchange's listing model.** It already trades oil, gold, stocks, FX and crypto
   at up to 50x on Monad. Its site is a JS shell and returned nothing — if its listing is
   permissionless, the lane is narrower than assumed.
3. ~~**Perpl's listing policy.**~~ **Resolved 2026-09-15 — see §2b. Listing is
   operator-controlled; even builder codes are gated behind a Google Form.**
4. ~~Dreamcash's $1.7M comes via CoinGecko's builder research; DefiLlama's own page
   returned 403.~~ **Resolved 2026-09-15.** DefiLlama's *API* answers even though the page
   403s: `api.llama.fi/summary/fees/dreamcash` → **$3,548,620 all-time fees**,
   **$2,616,032 all-time revenue**, $39,404 trailing 30d, chain `Hyperliquid L1`. The
   CoinGecko $1.7M figure is stale or counts only one of the three linked entities.
   hypurr's "bootstrapped, no token" and The Block's Tether investment remain compatible
   at different dates — still unverified, low stakes.
