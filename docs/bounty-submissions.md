# Bounty submissions (draft text for the form)

Links to use everywhere a link is asked:

- App (web, works on phones too): https://monad.opencash.in
- Android APK (latest): https://github.com/Markets-Finance/Opencash/releases/latest
- Source: https://github.com/Markets-Finance/Opencash (branch `monad`: https://github.com/Markets-Finance/Opencash/tree/monad)
- Code links below use the `monad` branch. Push it first (see the end of this file) or the links will 404.

Each section below is written to paste into the "describe" box (all are under 8,000 characters). Items marked CHECK are things to confirm on a real device or account before you submit.

---

## 1. Agora: Best Mobile Trading App on Monad

OpenCash is an Android app (and web app) that trades Perpl perpetuals on Monad mainnet. It is built around the three things this bounty asks for.

**Mera sign-in, no seed phrase.** A trader creates an account with a passkey (Face ID, fingerprint or device PIN). The wallet key is derived from the passkey's PRF output through Mera, so there is no seed phrase to write down and no extension. Returning users see one "Sign in" button. Signing out or deleting data brings back the full panel (create, import, sign in). An existing wallet can be imported with its private key, which is sealed by the passkey on the device and never sent anywhere. A dot-matrix "MERA x OPENCASH" loader plays while the passkey is saved, and the app opens on Home right after.

**AUSD balance everywhere.** Home shows the portfolio in AUSD. Deposit has two ways in: send straight to your Monad address, or pay from another chain through Aurora Intents. Any USDC that arrives is converted to AUSD automatically in the background. Margin, P&L, deposits, sends and bot sizing are all labelled in AUSD.

**Trades through Perpl.** Direct trades on any Perpl market, with entry, liquidation, stop and target lines drawn on the chart. "Bins" open a basket of markets (for example Chain Gang: ETH, SOL, MON, HYPE) in one transaction that fills together or reverts together. Once a bin is open, its screen becomes a position view with average entry, allocation, per-leg P&L and a P&L chart. An agent drafts bots from plain words, and bots can run on paper (fake money) or live on our server through a trade-only Perpl key that cannot withdraw.

**Mobile touches.** In-app update prompt that reads GitHub releases, first-run onboarding cards, cached balances and positions so tabs open instantly, low-gas warning, and a share-on-X card.

Proof of real use: a four-leg bin position (MON, ETH, SOL, HYPE) was opened from the app on Monad mainnet.

CHECK: record the demo on a real phone: create account, deposit, open a bin, show the position view, close it.

**Code on GitHub:**
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/screens/Account.tsx
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/components/BinPosition.tsx
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/screens/Bots.tsx
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/lib/updates.ts
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/mera
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/dotmatrix

---

## 2. Aurora Intents: Bring Any-Chain Liquidity to Monad

Deposit has an "Another chain" tab. The trader picks what they hold (USDC, USDT, ETH, SOL, BTC and others across chains) and an amount, and sees a live quote: what they get on Monad, cost in basis points, time estimate and the guaranteed minimum.

Tapping "Get my deposit address" asks the Aurora Intents service for a one-time deposit address on the source chain, with the trader's OpenCash Monad address as the recipient. For non-EVM chains the app asks for a refund address first, so a failed swap always has somewhere to return to. The trader sends funds to that address from any wallet. Aurora delivers USDC (or USDT0 or MON) to the trader's own Monad address.

OpenCash then finishes the job. A background check swaps any USDC in the wallet into AUSD on-chain, and the balance appears on Home as margin ready to trade. This runs on web and in the Android app.

The quote and address calls go through our backend, which keeps the Aurora key off the device and limits request rates. Referral accounts also get a small amount of MON for gas so the first swap does not need a second deposit.

CHECK: run one real small cross-chain deposit end to end and record it for the demo.

**Code on GitHub:**
- https://github.com/Markets-Finance/Opencash/tree/monad/backend/src/intents
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/intents
- https://github.com/Markets-Finance/Opencash/tree/monad/web/src/scripts/dashboard/funds.ts
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/screens/Deposit.tsx
- https://github.com/Markets-Finance/Opencash/tree/monad/backend/src/relayer

---

## 3. Perpl: Best use of Perpl's API

OpenCash uses Perpl's REST API for what the app cannot do from a phone: running bots while the app is closed.

**Key enrollment.** One passkey approval enrolls a trade-only API key. The backend asks Perpl for the key payload (`/v1/api-key/payload`), the trader signs the EIP-712 typed data with their wallet, and we submit the enrollment (`/v1/api-key/enroll`) with an Ed25519 proof of possession. The key can place and cancel orders but cannot withdraw. We found and fixed a detail that Perpl's own app handles: the typed-data domain chain ID must be a number when signing.

**Orders and exchange-side stops.** Bots place orders through `POST /v1/trading/orders`. A stop and a target are sent as trigger orders (mark-price conditions) that rest on Perpl, so they still protect the position if our server is down. The runner cancels stale triggers when a position closes, and partial fills on multi-leg strategies are rolled back.

**Market data.** Candles, order book, funding and tickers feed the agent's research tools, the strategy backtests, the chart overlays and the Perpl volume chart on Home.

**Builder code.** Orders carry our Perpl builder code with a fee cap the trader approves in the enrollment message.

**An agent on top.** A language-model agent reads the account balance and Perpl markets through the same API tools, tests its own draft with a risk preview, then returns a bot card. The agent only drafts. The trader chooses Paper or Live.

Safety rails: signed mandates per bot, per-wallet bot and leverage caps, a server kill switch, rate limits.

CHECK: confirm a live guard bot places and cancels real trigger orders on a small position, and note the order IDs for the demo.

**Code on GitHub:**
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/perpl/apikey
- https://github.com/Markets-Finance/Opencash/tree/monad/backend/src/runner
- https://github.com/Markets-Finance/Opencash/tree/monad/backend/src/agent
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/agent
- https://github.com/Markets-Finance/Opencash/tree/monad/docs/first-real-orders.md

---

## 4. Perpl: Best Analytics / Risk Tool

**Analytics tab.** Protocol volume (daily and cumulative), open interest and funding across Perpl markets, a markets table, capital flows and risk, and a wallet lookup that profiles any address from on-chain events (size tier, win streaks, drawdown, best and worst trades). Home shows exchange volume for the last 7 days when the trader has no open position.

**Risk before money moves.** Every strategy card gets a live preview before it can start: notional, entry fees, maximum loss at the stop, liquidation price and distance for each leg, slippage from the real order book, and a list of any rule it breaks (stop missing, stop beyond liquidation, leverage over the cap). Blocking issues stop the start button.

**Risk while a position is open.** Charts draw entry, liquidation, stop and target lines. Open bins have a position view with average entry, allocation, per-leg P&L and a bin P&L chart at the trader's own entry prices. Bots place their stops as exchange-side orders.

**Hard limits.** Per-wallet bot and leverage caps, a $10 minimum order, a low-gas warning, and a server kill switch.

Smart-money flow from Nansen is shown beside every bin and can gate a bot's entry.

**Code on GitHub:**
- https://github.com/Markets-Finance/Opencash/tree/monad/backend/src/analytics
- https://github.com/Markets-Finance/Opencash/tree/monad/web/src/scripts/dashboard/analytics
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/analysis
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/bins
- https://github.com/Markets-Finance/Opencash/tree/monad/web/src/scripts/dashboard/bins.ts

---

## 5. Nansen AI: Best use of Nansen

Nansen smart-money data is used as a signal, not decoration.

- **Bins.** Each bin's pop-up shows 7-day smart-money flow per asset (buying, selling or flat, net dollars, number of traders). Each bin card carries a tag showing whether smart money agrees with the bin.
- **Bot gate.** A strategy card can set "Nansen smart money must agree". The bot then opens only when the flow backs the trade's direction. The gate explains why it passed or blocked.
- **Agent tool.** The trading agent has a smart-money tool and uses it when the signal is on.
- **Wallet intel.** The Analytics wallet lookup uses Nansen labels for the address.
- **Trade and asset pages** show the read for the asset in the web app and the Android app.

The backend caches reads and enforces a credit cap, so a busy day cannot run the key dry. Flow data covers an asset across chains, which we state in the UI.

**Code on GitHub:**
- https://github.com/Markets-Finance/Opencash/tree/monad/backend/src/nansen
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/nansen
- https://github.com/Markets-Finance/Opencash/tree/monad/web/src/scripts/dashboard/nansen.ts
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/lib/nansen.ts

---

## 6. Monad Foundation: Best Mera-Powered UX on Monad

The whole product is a passkey experience.

- **Create** an account with a passkey in one step. Name and email label the passkey and are stored only on the device, sealed by the passkey.
- **Sign in** is one button for returning users. The panel opens with just "Sign in" and a "Use a different account" link. After Sign out or Delete data, the full set of options comes back.
- **Import** an existing wallet with its private key. It is sealed by the passkey on the device and never sent to us.
- **No friction after sign-in.** A dot-matrix loader reads MERA while the passkey is saved, then the app opens on Home. Web and Android use the same account.
- **Helpful errors.** Clear messages for a cancelled prompt, a missing passkey and a domain mismatch.
- **Recovery phrase** can be revealed from the passkey when the user wants it.
- **Onboarding.** A referral code can unlock higher limits and send a small gas grant, so a first trade works right after sign-up.
- **One approval turns on autonomous trading** (a trade-only key for bots). A second device with the same passkey opens the same account and the same notes.

**Code on GitHub:**
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/mera
- https://github.com/Markets-Finance/Opencash/tree/monad/web/src/scripts/dashboard/gate.ts
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/screens/Account.tsx
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/components/AuthShell.tsx
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/dotmatrix

---

## 7. Monad Foundation: Mera: One Passkey, Many Keys

Beyond signing transactions, OpenCash uses Mera's PRF output to mint separate keys for separate jobs, all rebuilt from the passkey and stored nowhere.

| Namespace | What it protects | Where the ciphertext lives |
|---|---|---|
| `terminal.profile.v1` | Name, email and avatar choice | The device only |
| `terminal.import.v1` | An imported private key | The device only |
| `opencash.notes.v2` | Private notes | Our server (Neon), as ciphertext |
| `opencash.agent.v1` | The agent chat history and last drafted bot | Our server (Neon), as ciphertext |

The notes and agent-memory namespaces each use their own PRF salt, so each needs its own passkey request and one cannot decrypt the other. The key is derived with HKDF from the PRF output and a namespace tag, and records are AES-GCM sealed. The server stores only the sealed record. Writes require a wallet signature over the record's digest, so no one else can overwrite a vault.

**Cross-device test.** Sign in on a second device with the same passkey, open Account then Private notes (or press Unlock memory in the agent card), approve the passkey, and the notes and agent chat decrypt there. Nothing sensitive is written to disk or the server in plain text.

Honest boundary: the agent memory is sealed at rest, but a question you ask is sent to the language-model provider to be answered. Profile and imported-key keys come from the sign-in PRF result, while notes and agent memory have their own salts.

CHECK: run the two-device demo live before the deadline and record it.

**Code on GitHub:**
- https://github.com/Markets-Finance/Opencash/tree/monad/packages/shared/src/mera
- https://github.com/Markets-Finance/Opencash/tree/monad/backend/src/vault
- https://github.com/Markets-Finance/Opencash/tree/monad/mobile/src/components/NotesPanel.tsx
- https://github.com/Markets-Finance/Opencash/tree/monad/web/src/scripts/dashboard/agent/memory.ts

---

## Pushing the code (commands to run yourself)

Your local remotes:

- `legacy` = https://github.com/Markets-Finance/Opencash.git (this is the repo you named)
- `origin` = git@github.com:Markets-Finance/open-cash.git (a different repo, the one currently in the form)

Make the form link and the remote you push to the same repo. Everything below pushes to `legacy` (Opencash). To check:

```bash
cd /Users/daiwi/project/monad
git status                      # should be clean
git log --oneline legacy/monad..monad | wc -l   # commits not on Opencash yet (run `git fetch legacy` first)
```

**All at once (simplest)**

```bash
git fetch legacy
git push legacy monad:monad
```

Then on GitHub, open Opencash > Settings > Branches and set the default branch to `monad`, so judges land on the right code. Do not force-push over `main`.

**Or in batches by subject.** A push of one commit sends all its ancestors, so run these in order. Each finds the newest commit with that subject and pushes up to it. The last command pushes everything that is left:

```bash
push_to() { git push legacy "$(git log --fixed-strings --grep="$1" -1 --format=%H):refs/heads/monad"; }

push_to "Release 1.0.5"                         # ports, stops, overlay, bots, MERA loader
push_to "Gas grant for referral accounts"       # notes, referral codes, legal pages, gas grant
push_to "Bots tab overhaul"                     # enrollment fix, agent, Bots and layout work
push_to "Release 1.0.9"                         # bin position, sealed memory, both apps
git push legacy monad:monad                     # the rest: docs and bounty links
```

After the last command the branch matches your local `monad`.

To commit a new change by subject from here, stage only that subject's files, for example:

```bash
git add docs/bounty-submissions.md
git commit -m "Docs: bounty links"
git push legacy monad:monad
```
