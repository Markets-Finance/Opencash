# OpenCash — product plan (tabs, features, how they work, build order)

Drafted 2026-10-06 from the research in `research-hyperliquid-product.md` (§11 Floor, §12 inspiration,
§13 real rate + stocks). Product line: **leverage with a floor** on Hyperliquid, phone (Android/Expo) and
web (Astro). UI is built by the `ui` session; this plan is the spec it builds from.

Open decisions are marked **[decide]**; the plan uses the recommended default in each case.

---

## 1. Tabs

Same four tabs on phone and web. Existing tabs are renamed/re-scoped, not added.

| Tab | Purpose | v1 | v2 | v3 |
|---|---|---|---|---|
| **Home** | "How am I doing, and how protected am I?" | Total value, protected value, active Floor positions, floor yield earned | Guardrail status, coaching cards ("your floor saved $X") | — |
| **Discover** (was Bins) | "What can I bet on?" | Floored stock bins (curated) | Swipe feed of themes/headlines, weekend desk, smart-money context | AI translator, creator bins |
| **Trade** | "Bet on one market" | Floor ticket (default) + Pro ticket (plain perp, as built today) | Basket chart + basket TP/SL for bins | Floored Bin Tokens |
| **Account** | "My money and my rules" | Wallet, deposit, withdraw (verified addresses), positions history | Guardrail settings, tier and leverage cap | — |

---

## 2. Features by tab — what the user sees and what happens underneath

### 2.1 Trade → Floor ticket (v1, the core)

**User sees**
1. Market picker (any main-book perp or `xyz` stock/commodity).
2. Amount ($), floor slider — 80% / 90% / 95% **[decide default: 80%]**.
3. Live deal preview:
   > $100 in · can't end below **$80** · you get **~1x** of every move up · floor earns **3.47%** · fees ~$0.02
4. Sleeve setting: **5x** (default) or **3x "steadier"** **[decide]**.
5. One button: "Open with floor".

**Underneath (one tap → these actions, in order)**
1. **Guardrail check** (v2; v1 = leverage cap + $10-per-leg minimum).
2. `borrowLend {operation: "supply", token: 0 (USDC), amount: floor $}` from the user's **spot** USDC →
   the floor earns the USDC supply rate and is out of reach of perp margin.
3. `updateLeverage {isCross: false, leverage: 5}` on the market, then the sleeve order (isolated margin
   from the perp balance of that dex); builder fee attached. ~~Sub-account per position~~ — dropped: see §5.
5. Record the position: floor $, sleeve sub-account, entry, participation, knock-out price.

**Close**: close the sleeve (reduce-only), `borrowLend {operation: "withdraw"}` the floor (all of it if
less than $1 would remain). Result = floor + interest + sleeve value.

**Knock-out (sleeve liquidated)**: position shows "Parked at floor — earning 3.47%". Two buttons:
**Re-arm** (start a new sleeve from the floor; preview shows the new, lower floor) or **Close**.
**[decide: re-arm prompt vs auto-default to 3x]**

### 2.2 Trade → Pro ticket (v1, already built)
Plain perp/spot ticket as built today: post-only default, leverage, cross/isolated, $10 minimum, cap.
Kept for experienced users; Floor is the default tab state.

### 2.3 Discover → Floored stock bins (v1)
- Curated cards: e.g. "US large-cap" (SP500 + XYZ100), "AI compute" (NVDA + XYZ100), "Gold & silver".
  Weighted legs, each `xyz` market. **[decide: who writes themes — v1 = us]**
- Tap → same Floor ticket, but the sleeve is the basket: one isolated position per leg in the same
  sub-account, sized by weight, each leg ≥ $10 notional (so a 5-leg bin at 5x needs ≥ $10 sleeve per leg).
- v2: one basket chart (weighted index of leg prices) and a basket-level TP/SL (close all legs when basket
  value crosses a level) — Pear pattern.

### 2.4 Home (v1)
- **Total value** and **protected value** (sum of floors + interest).
- Active Floor positions: market/bin, floor, current value, distance to knock-out, upside share.
- Parked positions (knocked out) with Re-arm.
- Floor yield earned to date.

### 2.5 Account (v1)
- Passkey sign-in; Hyperliquid wallet connection **[decide: passkey-derived account vs Privy/Turnkey]**.
- Approve agent + builder fee (one-time, main wallet).
- Deposit (gasless permit + relayer, v1.1) and withdraw — **verified addresses only** (guard built).
- History of Floor positions with final outcomes.

### 2.6 v2 features
- **Guardrails** (Account settings, enforced in the order path): daily loss halt, cooldown after a loss
  above X, max entries/day, leverage cap by tier/deposit; **fail-closed** — if the account state can't be
  read, no order is sent. `scheduleCancel` as a dead-man switch for resting orders.
- **Coaching** (Home cards): "floor saved $X vs unfloored", "you'd have made $Y at 1x".
- **Swipe feed** (Discover): card per theme/headline; right = open with default floor, left = opposite
  side, up = skip.
- **Weekend desk** (Discover): stock/commodity markets with "moved since Friday close".
- **Smart-money context** (on bin cards): "N large traders are long these legs" — context only.

### 2.7 v3 features
- **AI translator** (Discover): text → proposed floored bin (legs, weights, floor), user approves.
  Provider per user rules: NVIDIA NIM `openai/gpt-oss-20b`. Never places orders itself.
- **Floored Bin Tokens**: HyperEVM contract holding lend + sleeve via CoreWriter; needs audit.
- **Creator bins**: creators publish themes, share the builder fee.

---

## 3. Build order (with checks)

### Phase 0 — verify the floor mechanics on testnet (research session, scripts only)
Rules: testnet only, ≤ $10.50 per order, own verified addresses only, no secrets printed.
1. `borrowLend supply` USDC on testnet → check `borrowLendUserState` shows the supply and interest accrues.
   → verify: supplied balance visible; can withdraw back.
2. Does supplied USDC count as perp margin on the master account? (It must **not** be at risk from a sleeve.)
   → verify: master account margin/withdrawable before and after supply.
3. `createSubAccount` + `subAccountTransfer`; place an isolated 5x order **in the sub-account signed by the
   agent** (via `vaultAddress`) → verify: order accepted; position appears only in the sub-account.
4. Isolation: a liquidation can't be forced on demand, so verify the boundary instead — after a losing
   close in the sub-account, confirm the master account and its supplied USDC are unchanged.
5. Close path: reduce-only close, transfer back, withdraw supply → verify final balances.
6. Which of these actions the **agent** can sign vs need the **main wallet** (affects how many passkey
   prompts the Floor ticket needs).

### Phase 1 — Floor engine (shared code, no UI)
`packages/shared/src/hl/floor.ts`: `previewFloor(amount, floorPct, sleeveLev, market)`,
`openFloor(...)`, `closeFloor(...)`, `rearmFloor(...)`, `floorStatus(...)`; position records stored locally
first. → verify: a testnet script opens, reads, closes a floor position end to end within the caps.

### Phase 2 — v1 UI (ui session)
Trade Floor ticket + deal preview, Home protected value + positions, knock-out/re-arm state, Account
approvals and verified withdraw. → verify: Android emulator + web, testnet, screenshots per tab.

### Phase 3 — floored stock bins
Bin definitions (curated JSON), multi-leg sleeve in one sub-account, basket value. → verify: a 2-leg floored
bin on testnet.

### Phase 4 — v2 (guardrails, coaching, feed, weekend desk). Phase 5 — v3.

---

## 4. Open decisions
1. Default floor: 80% (≈1x upside) or 90% (≈0.5x).
2. After knock-out: re-arm prompt, or 3x sleeve by default.
3. Wallet: passkey-derived account vs Privy/Turnkey.
4. Theme authorship beyond v1.
5. Legal wording of "floor" / "can't end below" — needs a lawyer.

---

## 5. Build log

### Phase 0 + Phase 1 — done 2026-10-07 (testnet)
Engine: `packages/shared/src/hl/floor.ts` — `previewFloor`, `openFloor`, `floorStatus`, `closeFloor`,
`rearmFloor`, `withdrawSupply`, `suppliedUsdc`. Scripts: `backend/scripts/hl-floor.ts`,
`backend/scripts/hl-floor-rearm.ts`. All orders ≤ $10.50, own addresses only.

| Check | Result |
|---|---|
| Agent key can supply / withdraw USDC lending | **Yes** — no main-wallet prompt needed |
| Where supply comes from | **Spot** USDC; perp equity unchanged |
| Sub-accounts | **Blocked for normal users**: `Cannot create sub-accounts until enough volume traded. Required: $100000` |
| Isolation without sub-accounts | Floor in spot lending, sleeve isolated perp: opening the sleeve moved spot + lent by **$0.0000**; perp moved only by fees |
| ETH floor (main book) open → status → close | **OK**: $17.82 floor + $1.98 sleeve at 5x (0.0039 ETH); knock-out 2131.5 (18.3% away); round trip −$0.013 |
| Gold floor (`xyz:GOLD`) | **OK** after a sizing fix: 0.0025 @ 4151.2 isolated 5x, sleeve margin from the `xyz` dex balance; round trip −$0.04 |
| Re-arm after knock-out (simulated by closing the sleeve) | **OK**: $2.06 withdrawn from lending, moved spot→perp (**needs main wallet**: user-signed), new sleeve opened; floor 18.54 → 16.48 |

Bugs found and fixed by the testnet runs:
1. **Withdraw leaving dust** — `Minimum amount supplied is $1` when interest left a remainder under $1;
   now withdraws everything (`amount: null`) when the remainder would be < $1.
2. **$10 minimum checked at mark, not limit** — a buy sized at limit price passed locally and failed on the
   exchange; sizing now uses the lower of mark and limit (+0.2% buffer) for the minimum and the higher for the cap.
3. Rollback on a failed sleeve order returns the floor from lending (exercised by bug 2: lent ended at 0).

Design consequences:
- **One floor per market per account** (Hyperliquid nets positions per asset); the engine refuses a second.
- Passkey prompts per floor: **0** for open/close (agent signs lend + orders); **1** for re-arm (spot→perp
  transfer is user-signed). Deposits land in perp, so the first floor needs one perp→spot transfer (main).
- Floor values are apportioned from one shared USDC supply by each record's floor size.

Not yet covered: short floors, several floors at once, a real (not simulated) liquidation, persistence of
floor records (callers hold them today), portfolio-margin / unified accounts (the floor must not become margin
— the engine assumes a standard account; not checked programmatically).
