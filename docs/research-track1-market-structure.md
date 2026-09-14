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

It charges **0% builder fee** and still cleared **~$1.7M**, ranking #9 among Hyperliquid
builders. It monetises by **owning the venue**: it deployed its own HIP-3 perp DEX
("CASH", USDT0-quoted) and takes 50% of fees on the markets it deployed.

- 10 RWA perps: S&P 500, gold, silver, TSLA, NVDA, GOOGL, AMZN, META, MSFT, INTC, HOOD.
- **Tether invested (Feb 2026)**, amount undisclosed, and funds a **$200,000/week**
  incentive programme for CASH markets paid on share of USDT volume.
- **Selini Capital was the liquidity provider.** Even a venue that owns its markets had
  to hire a professional LP. Owning the market gets you the economics, not the depth.
- Their own framing of the wedge: *"Until now, there has been no way for the millions of
  traders holding USDT to access Hyperliquid markets directly."* The wedge was the
  **collateral asset**, not the tickers — HIP-3 lets the deployer pick the quote asset.
- It later **retired the USDT-quoted CASH market** once USDC became the dominant
  Hyperliquid quote asset. The frontend was unaffected. The venue wedge decayed in under
  a year; the app survived it.

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
| **Dreamcash** | **$1.7M** | **0%** | — | **owns its own markets** |

**Conclusion:** frontends race to zero (Axiom traded $22.1B for $2.3M). Market owners and
distribution owners do not.

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
   direction rests on "no". Verify against Perpl, Bean, LeverUp, Drake, Monday Trade.
2. **Bean Exchange's listing model.** It already trades oil, gold, stocks, FX and crypto
   at up to 50x on Monad. Its site is a JS shell and returned nothing — if its listing is
   permissionless, the lane is narrower than assumed.
3. **Perpl's listing policy.** Its docs cover Builder Codes but say nothing about who may
   list a market.
4. Dreamcash's $1.7M comes via CoinGecko's builder research; DefiLlama's own page
   returned 403. hypurr lists Dreamcash as bootstrapped with no token while The Block
   reports the Tether investment — both can be true at different dates.
