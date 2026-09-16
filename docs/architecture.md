# Architecture — oracle-priced, vault-backed perp factory on Monad

Status: **spec, not yet implemented.** Supersedes the off-chain-CLOB Miro diagram; see
[§13](#13-what-we-dropped-from-the-clob-diagram-and-why) for what was dropped and why.
Companion docs: [`decisions.md`](./decisions.md),
[`research-track1-market-structure.md`](./research-track1-market-structure.md).

---

## 1. What we are building

A **permissionless perpetual-futures market factory** on Monad, with a mobile-first
passkey client.

Anyone deploys a perp market by choosing a Pyth feed, a leverage cap and a fee split, and
posting a slashable stake. The market is tradeable the instant it exists, because the
counterparty is a protocol liquidity vault rather than an order book that starts empty.

Three properties define it:

1. **No matching engine.** Price comes from an oracle; a trade is a contract call.
2. **No borrowing.** `notional = margin × leverage` is accounting. Nothing is lent, no
   interest accrues, there is no lending pool on the critical path.
3. **No operator on the critical path.** Every off-chain service is convenience. Users can
   open, close and withdraw directly against the contracts if all of it is down.

---

## 2. Layers

```
L1  CLIENT     Expo (iOS/Android) · Astro (web) · Privy passkey embedded wallet
L2  EDGE       API Gateway (Fastify+viem) · Envio indexer · Pyth Hermes relay
               Redis (UI cache) · onramp/offramp · referral · VIP tiers · stats
               ─────── convenience only; no custody, no censorship power ───────
L3  KEEPERS    liquidator (permissionless, competes on priority fee)
L4  CHAIN      MarketFactory → PerpMarket clones (EIP-1167)
               MarginVault · LiquidityVault · InsuranceFund
               PythAdapter · FeeSplitter
```

Repo mapping to the existing pnpm workspace:

| Path | Contents |
|---|---|
| `contracts/` | Foundry — everything in L4 |
| `backend/` | Fastify + viem — L2 gateway, keeper runner |
| `android/` | Expo/React Native — L1 mobile |
| `web/` | Astro — L1 web, stats dashboard |
| `packages/shared/` | chain config, ABIs, market math mirrored in TS |

---

## 3. Contracts

### 3.1 MarketFactory

Deploys and registers markets. Holds deployer stake.

```solidity
struct MarketParams {
    bytes32 pythFeedId;
    uint64  maxLeverage;      // 1e4 = 1x   → imr = 1e8 / maxLeverage
    uint64  mmrBps;           // maintenance margin ratio, bps of notional
    uint128 skewScale;        // impact + funding normaliser, base units 1e18
    uint128 maxOI;            // per side, 1e18
    uint128 maxSkew;          // |OI_long - OI_short| cap, 1e18
    uint32  openFeeBps;
    uint32  deployerFeeShareBps;  // share of openFee, capped
}

function deployMarket(MarketParams calldata p) external payable returns (address market);
function addStake(address market) external payable;
function requestUnstake(address market) external;          // starts cooldown
function withdrawStake(address market) external;           // only if OI == 0 and cooldown passed
function slash(address market, uint256 amount, bytes32 reason) external onlyGuardian;
```

**Stake gates OI.** This is the HIP-3 analogue and the reason permissionless listing is
safe:

```
effectiveMaxOI = min(p.maxOI, stake * STAKE_OI_MULTIPLIER)
```

A market with no stake can hold no open interest. A deployer who wants size must have
skin at risk.

Markets are **EIP-1167 minimal proxies** of a single audited `PerpMarket` implementation.
Cheap to deploy, and — critically for Monad — each clone owns a disjoint storage region.

### 3.2 PerpMarket (one clone per market)

```solidity
struct MarketState {          // slot 0 + 1, one 128-slot page
    int128  skew;                 // OI_long - OI_short, 1e18
    uint128 oiLong;               // 1e18
    uint128 oiShort;              // 1e18
    int128  fundingRate;          // per day, 1e18
    int128  fundingAccLong;       // accumulator per unit size, 1e18
    uint64  lastFundingTime;
    uint64  lastPrice;            // last settled oracle price, for UI
    bool    reduceOnly;           // set when oracle degrades
}

struct Position {             // one slot pair per user
    int128  size;                 // signed, 1e18. + long, - short
    uint128 margin;               // locked collateral, 1e18 internal
    uint128 entryPrice;           // 1e18
    int128  fundingAccEntry;      // accumulator snapshot at last touch
    uint64  lastUpdate;
}
```

```solidity
function openPosition(
    int256  sizeDelta,          // signed; + increases long
    uint256 acceptablePrice,    // slippage bound
    uint256 marginDelta,        // additional collateral to lock
    bytes[] calldata pythUpdate
) external payable;

function closePosition(uint256 acceptablePrice, bytes[] calldata pythUpdate) external payable;
function liquidate(address account, bytes[] calldata pythUpdate) external payable;
function settleFunding() public;                 // lazy, called by every mutating path
function positionEquity(address account) public view returns (int256);
```

### 3.3 MarginVault

Holds **user** collateral. Per-account free/locked balances. Never lends, never invests,
never funds the house's exposure.

```solidity
function deposit(uint256 amount) external;
function withdraw(uint256 amount) external;      // free balance only, no operator gate
function lock(address account, uint256 amount) external onlyMarket;
function unlock(address account, uint256 amount) external onlyMarket;
function settle(address account, int256 delta) external onlyMarket;  // pnl, funding, fees
```

### 3.4 LiquidityVault

**ERC-4626 over AUSD.** The counterparty to every trade in every market. Earns open fees,
trader losses and residual funding; pays trader profits.

```solidity
function deposit(uint256 assets, address receiver) external returns (uint256 shares);
function requestRedeem(uint256 shares) external;            // starts cooldown
function redeem(uint256 shares, address to, address owner) external returns (uint256);
function totalAssets() public view returns (uint256);        // cash + Σ market equity, lazy
function marketPnl(address market) external view returns (int256);
```

- **Utilisation cap** — redemptions blocked beyond `maxUtilisation` so the vault can always
  meet open exposure.
- **Redeem cooldown** — 24h default. Prevents LPs exiting ahead of a known loss.
- `totalAssets()` aggregates market equity **lazily on read**, never written on the trade
  path. See [§6](#6-monad-specific-engineering).

### 3.5 InsuranceFund

Covers bad debt when a liquidation closes below zero equity. Funded by a share of open
fees and liquidation fees, topped up by `Admin`.

```solidity
function cover(address market, uint256 shortfall) external onlyMarket returns (uint256 covered);
function deposit(uint256 amount) external;
```

If `covered < shortfall`, the market triggers **ADL** ([§4.6](#46-adl)).

### 3.6 PythAdapter

```solidity
function updateAndRead(bytes32 feedId, bytes[] calldata updateData)
    external payable returns (uint256 price, bool degraded);
```

```
fee = pyth.getUpdateFee(updateData)
pyth.updatePriceFeeds{value: fee}(updateData)
p = pyth.getPriceNoOlderThan(feedId, MAX_AGE)          // MAX_AGE = 10s
degraded = p.conf * 1e4 > uint(p.price) * MAX_CONF_BPS // MAX_CONF_BPS = 50 (0.5%)
price = normalise(p.price, p.expo) → 1e18
```

`degraded == true` ⇒ market enters **reduce-only**: closes and liquidations allowed,
opens and increases reverted. Never trade on a stale or low-confidence price.

### 3.7 FeeSplitter

Routes the open fee: protocol · market deployer · referrer · LiquidityVault ·
InsuranceFund. Referral and VIP tier discounts resolve here, on-chain, so L2 cannot alter
what a user pays.

---

## 4. Math

All internal precision `1e18`. AUSD is `1e6` and is scaled on the vault boundary.

### 4.1 Price impact

Synthetix Perps V2 model — a continuous spread proportional to how much the trade moves
imbalance:

```
pdBefore  = skewBefore / skewScale
pdAfter   = skewAfter  / skewScale
execPrice = oraclePrice × (1 + (pdBefore + pdAfter) / 2)
```

Increasing skew costs; reducing skew is rewarded. This is what prevents the vault from
being picked off and what makes one-sided markets self-correcting.

### 4.2 Funding — velocity, not proportional

```
velocity      = maxFundingVelocity × (skew / skewScale)      // per day²
fundingRate  += velocity × Δt / 1 day
fundingAccLong += fundingRate_avg × Δt / 1 day
```

The **rate drifts** while skew persists rather than sitting at a level. Persistent
one-sidedness therefore becomes ever more expensive, which is what actually clears skew.

Per-position, O(1), no iteration:

```
fundingOwed = size × (fundingAccLong_now − fundingAccEntry)
```

Accrual is **lazy** — computed from `lastFundingTime` on every touch. Idle markets need no
keeper. Monad's 300 ms blocks make this effectively continuous; Perpl settles every 43 min.

### 4.3 Margin and equity

```
notional          = |size| × price
imr               = 1e8 / maxLeverage
initialMargin     = notional × imr
maintenanceMargin = notional × mmrBps / 1e4
pnl               = size × (price − entryPrice)        // signed size handles direction
equity            = margin + pnl − fundingOwed
```

Open or increase requires `equity ≥ initialMargin` **after** the trade.

### 4.4 Caps, checked post-trade

```
require(oiLong  ≤ effectiveMaxOI)
require(oiShort ≤ effectiveMaxOI)
require(|skew|  ≤ maxSkew)
```

`maxSkew` is the LiquidityVault's real risk limit — OI can be large if balanced; it is
*imbalance* that costs the LP.

### 4.5 Liquidation

```
liquidatable ⟺ equity < maintenanceMargin
close at execPrice (impact applies)
liqFee = notional × liqFeeBps      → keeper share + insurance share
equity − liqFee > 0  → remainder unlocked to user
equity < 0           → InsuranceFund.cover(shortfall)
                     → if uncovered, ADL
```

Keepers are permissionless and compete on priority fee — which is already how Monad's
leader orders transactions, so liquidation is an auction with no extra machinery.

### 4.6 ADL

Final backstop when the InsuranceFund cannot cover. Rank **opposite-side profitable**
positions by `profitPct × leverage`, close from the top at mark until the market is solvent.
Deterministic, published ranking — users can see their ADL position in the UI.

---

## 5. Flow of funds

```
DEPOSIT
  fiat → Onramp → AUSD (Monad) → MarginVault.deposit() → free

OPEN                                       [one tx, ~600ms final]
  PerpMarket.openPosition(sizeDelta, acceptablePrice, marginDelta, pythUpdate)
    settleFunding()                         lazy accrual since lastFundingTime
    PythAdapter.updateAndRead()             fresh price, guards
    execPrice = oracle × (1 + impact)
    MarginVault.lock(initialMargin)
    LiquidityVault takes opposite delta
    openFee → FeeSplitter → protocol / deployer / referrer / LP / insurance
    caps checked post-trade

HOLD
  funding accrues continuously, longs ⇄ shorts
  residual skew funding ⇄ LiquidityVault    ← this is what pays LPs

CLOSE
  pnl settled: MarginVault.settle(±)        vault is the counterparty
  MarginVault.unlock(margin)

LIQUIDATE
  keeper → liquidate() → close, fee split, shortfall → Insurance → ADL

WITHDRAW
  MarginVault.withdraw(free)                direct call, no operator
  LP: requestRedeem → cooldown → redeem     subject to utilisation cap
  → Offramp → fiat
```

**Invariant:** user collateral and LP capital never mix. `MarginVault` AUSD balance always
equals `Σ(free + locked)` across accounts.

---

## 6. Monad-specific engineering

| Monad property | Consequence for this design |
|---|---|
| Optimistic parallel execution, storage warmed per **128-slot page** | One clone per market ⇒ disjoint pages ⇒ trades on different markets run in parallel. **Never write a global accounting slot on the trade path** or everything serialises |
| 300 ms blocks / 600 ms finality | Continuous funding accrual; UI need never show a pending state |
| Gas charged on **limit, not usage** | Tight per-action gas limits; keeper economics budgeted on the limit |
| No global mempool | Order flow private by default — this is the dark-pool goal, for free |
| Leader orders by descending fee-per-gas | Liquidation is already a priority auction; no custom auction needed |
| Reserve balance — included-but-reverted is real | Client must render "included, reverted" as a distinct state |

`LiquidityVault.totalAssets()` aggregating market equity is the one tempting global write.
It must stay a **view that reads across markets**, with each market accumulating its own
PnL locally.

---

## 7. Keepers

Only **one** is required.

| Keeper | Trigger | Incentive |
|---|---|---|
| **Liquidator** | `equity < maintenanceMargin` | `liqFee` share |

No funding keeper (lazy accrual). No oracle keeper (users bring their own price update
in-tx; liquidators bring one with the liquidation).

---

## 8. Off-chain services (L2)

| Service | Role | If it dies |
|---|---|---|
| API Gateway | quotes, history, routing helpers | users trade direct against contracts |
| Envio indexer | positions, fills, funding history, leaderboards | UI loses history, chain unaffected |
| Pyth Hermes relay | streams prices to clients | client fetches Hermes directly |
| Redis | UI cache, leaderboard, rate cache | cold reads from indexer |
| Onramp/Offramp | fiat rails | users bridge AUSD themselves |
| Referral / VIP | attribution UI | splits already enforced on-chain |

---

## 9. Client

- **Expo / React Native** (iOS + Android), **Astro** web, shared TS market math from
  `packages/shared` so quoted price matches on-chain execution exactly.
- **Privy embedded wallet + passkey.** Face ID to sign; no seed phrase.
- Trade is one signed tx bundling the Pyth update — no approve step after the first
  `MarginVault` allowance.
- Must render: *included-but-reverted*, *reduce-only (oracle degraded)*, *ADL rank*.

---

## 10. Parameters — starting values

| Parameter | Start | Notes |
|---|---|---|
| Collateral | AUSD (6 dp) | matches Perpl and the Agora relationship |
| Margin mode | **isolated** | cross is a later differentiator |
| `MAX_AGE` (oracle) | 10 s | else reduce-only |
| `MAX_CONF_BPS` | 50 (0.5 %) | else reduce-only |
| `maxLeverage` | 20x majors, 10x long-tail | deployer-set, factory-capped |
| `mmrBps` | `imr / 2` | |
| `skewScale` | ≈ 5× expected daily volume | the single most sensitive knob |
| `maxFundingVelocity` | 9 %/day² | SNX default |
| `openFeeBps` | 6 | fee on open only, like Perpl |
| `liqFeeBps` | 50 | keeper + insurance |
| `STAKE_OI_MULTIPLIER` | 10x | $1 stake ⇒ $10 OI |
| LP redeem cooldown | 24 h | |
| LP max utilisation | 80 % | |

`skewScale` is the knob that decides whether the venue feels liquid or extortionate. Set
it per market from real volume, and make it adjustable by governance, not by the deployer.

---

## 11. Security invariants

1. `MarginVault` AUSD balance == `Σ(free + locked)`. User funds are never LP capital.
2. No path lets `LiquidityVault` draw from `MarginVault`.
3. Opens revert unless post-trade `equity ≥ initialMargin`.
4. OI and skew caps checked **after** the state change, never before.
5. Oracle stale or low-confidence ⇒ reduce-only. No trade ever executes on a guarded price.
6. Deployer stake cannot be withdrawn while the market holds OI.
7. Every clone is a proxy of one audited implementation; markets cannot ship custom logic.
8. `withdraw()` has no operator gate, no pause that can hold user funds.

Attack surface to test explicitly — the HLP $12–13.5 M incident
([research §6](./research-track1-market-structure.md)) was offsetting positions forcing a
liquidation. Per-market isolation, skew caps and impact priced off the market's own OI are
the mitigations, and they are load-bearing, not polish.

---

## 12. Build sequence

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Foundry scaffold, AUSD mock, Monad `anvil` (`category-labs/foundry v1.5.0-monad.0.2.0`) | `forge test` green locally |
| 1 | `MarginVault` + `LiquidityVault` | deposit/withdraw/lock/unlock invariant-tested |
| 2 | `PythAdapter` | reads testnet Pyth, guards proven by fork test |
| 3 | `PerpMarket`, **one hardcoded market (MON)** | open→funding→close→liquidate on Monad testnet |
| 4 | `InsuranceFund` + ADL | forced-insolvency test passes |
| 5 | `MarketFactory` + stake + caps | third party lists a market from a script |
| 6 | Liquidator keeper | liquidates within 1 block of eligibility on testnet |
| 7 | Envio indexer + API Gateway | positions and history queryable |
| 8 | Expo client + Privy passkey | open and close a position on a phone |
| 9 | Audit, parameter tuning, mainnet | |

Phases 3 and 5 are the product. Everything else is support.

---

## 13. What we dropped from the CLOB diagram, and why

| Component | Fate | Reason |
|---|---|---|
| Matching Engine (XTPL) | dropped | no orders to match; price is the oracle |
| Settlement Re-layer | dropped | the user's tx *is* settlement — removes the trust boundary |
| Ephemeral Vault | dropped | no in-flight trades to buffer |
| Darkpool | dropped | Monad has no global mempool; flow is already private |
| Forced-withdrawal escape hatch | **not needed** | no operator can gate `withdraw()` |
| Liquidation Engine | **kept, changed** | permissionless keeper, not an operated service |
| Funding Rate service | **kept, moved on-chain** | Redis demoted to UI cache |
| Collateral Vault | **kept, split in two** | user margin vs LP capital must never mix |
| Insurance Fund, Oracle, Admin, RPC | kept | |
| API Gateway, Privy, onramp, referral, VIP, stats | kept unchanged | the product layer was always right |
| **Market factory** | **added** | absent from the diagram, and it is the entire thesis |
| **LP vault** | **added** | the diagram had no source of counterparty liquidity |
| **ADL** | **added** | insurance fund with no backstop is an insolvency waiting to happen |

**What we give up:** no price-time priority and no maker rebates, so professional makers
will arbitrage the vault rather than quote it. LP yield — fees + funding + trader losses,
minus adverse selection — is the liquidity story, not maker depth. If the top markets later
justify a CLOB, it layers on top while the vault remains the day-zero counterparty for
every new listing.

---

## 14. Open decisions

1. **Isolated vs cross margin.** Spec assumes isolated. Cross is a differentiator against
   Perpl but complicates liquidation materially.
2. **Permissionless from day one, or curated then opened?** Stake-gated OI makes day-one
   defensible, but a bad first listing is a reputational event.
3. **Multi-collateral.** AUSD only to start. Adding collateral types multiplies oracle and
   liquidation surface.
4. **Who tunes `skewScale`?** Recommended: governance, not the deployer — a deployer can
   otherwise set it to farm their own fee share.
5. **ADL vs socialised loss** as the final backstop. Spec assumes ADL.
