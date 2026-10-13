# Bounty deep dive (longer answers, one per bounty)

Use these when a box allows long text (each is under 8,000 characters). The shorter versions are in `bounty-submissions.md`. Anything marked CHECK should be confirmed live before you submit.

Where to point judges in the repo:

- Shared logic (both apps and the server): `packages/shared/src`
- Server: `backend/src`
- Web app: `web/src`
- Android app: `mobile/src`

---

## 1. Agora: Best Mobile Trading App on Monad

**The three required features, and how they connect**

*1. Mera authentication.* The wallet is derived from a passkey's PRF output, so a trader's identity, signing key and encryption keys all come from one gesture.
- Create: name and email label the passkey. They are sealed on the device and never sent to the server.
- Sign in: one button for returning users. The app checks for a stored credential, so after Sign out or Delete data the full panel (create, import, sign in) returns.
- Import: an existing private key is sealed by the passkey on the device only.
- Passkey errors are translated: cancelled prompt, no passkey on this device, and a domain mismatch each get a plain message.
- The Android app uses its own app ID and its own passkey domain, with a signed `assetlinks.json`, so credentials cannot leak between apps.

*2. AUSD balance.* AUSD is the unit for everything the trader sees.
- Home shows the portfolio (Perpl margin plus open P&L) in AUSD. The wallet card also shows AUSD.
- Deposit from Monad: send to your OpenCash address. USDC is converted to AUSD by a background check that runs while the app is open (every 30 seconds).
- Deposit from another chain: Aurora Intents (see the Aurora bounty).
- Send and withdraw are in AUSD. A low-gas warning appears when MON runs short.
- A balance cache shows the last known value instantly, then refreshes in the background.

*3. Perpl trades.*
- Direct trades on every listed market with entry, liquidation, stop and target lines.
- Bins: a basket opened in one transaction using Perpl's batch order call. Legs fill together or revert together.
- If the account already holds free margin, the trade uses it and deposits only the shortfall, with a clear message if the wallet cannot cover it.
- After opening, the bin screen becomes a position view: allocation, average entry, size, mark, per-leg P&L, and a bin P&L chart at the trader's entry prices.
- Positions can be closed leg by leg or all at once.

**Mobile craft**
- First-run onboarding cards in the app's colours.
- A dot-matrix loader that reads MERA x OPENCASH while the passkey is saved.
- Android back button handling, scrollable forms, and bins that never open half-filled.
- In-app update prompt. The app reads GitHub releases and compares them to its own version.
- Share on X, and a referral field that can unlock limits and send a small gas grant.

**Evidence.** A four-leg Chain Gang bin (MON, ETH, SOL, HYPE) was opened from the app on Monad mainnet. The release APKs are signed with a release key whose fingerprint matches the domain's `assetlinks.json`.

CHECK: record the demo on a physical phone.

---

## 2. Aurora Intents: Bring Any-Chain Liquidity to Monad

**What a trader does**
1. Deposit, then "Another chain".
2. Pick what you hold. The list is built from Aurora's token catalog and puts USDC, USDT, ETH, SOL, BTC, MON and BNB first. Pick the Monad token you want (USDC, USDT0 or MON).
3. The app shows a live quote from a dry run: amount out, cost in basis points, estimated time and the minimum you are guaranteed.
4. For EVM chains the refund address is the trader's own address. For other chains the app asks for one before it will continue, so a failed swap always has somewhere to go.
5. "Get my deposit address" creates a real one-time address on the source chain. The trader sends from any wallet. The destination is their own OpenCash address on Monad.
6. Funds arrive as USDC. A background check converts it to AUSD on-chain through the swap venue, and Home updates.

**How it is built**
- The browser and app never hold the Aurora key. Quote, token list and deposit-address calls go through our backend (`backend/src/intents`), with rate limiting.
- Shared helpers (`packages/shared/src/intents`) turn amounts into base units, rank sources and compute cost in basis points, and are covered by a check that quotes real routes from several chains (Ethereum, Base, Solana, Arbitrum, Bitcoin, BNB) to Monad USDC.
- The same code serves the web app and the Android app, so the flow is identical on both.
- Referral accounts get a small MON gas grant from a relayer so the first on-chain conversion does not need a second deposit. The grant is once per wallet, capped per day and only works with a funded relayer.

**Why it matters for Monad liquidity.** A new trader arrives with funds on a chain they already use, and ends with AUSD margin on Perpl without ever opening a bridge UI.

CHECK: run one small real deposit end to end and keep the transaction links for the video.

---

## 3. Perpl: Best use of Perpl's API

**What we use, and why**

*Key enrollment (`packages/shared/src/perpl/apikey`).*
1. Ask Perpl for a payload: `POST /v1/api-key/payload` with the wallet address, an Ed25519 public key, a trade-only scope and a label.
2. The wallet signs the returned EIP-712 typed data. One detail matters: Perpl's own client converts the domain chain ID to a number before signing. We do the same.
3. We sign the typed-data digest with the Ed25519 private key as proof of possession and submit `POST /v1/api-key/enroll`.
4. The server stores the key encrypted at rest and signs later requests with it. It cannot withdraw.

*Orders (`POST /v1/trading/orders`).* Entries are IOC orders with a price limit. Stops and targets are trigger orders on the mark price that rest on Perpl, so they protect the position even if our server is down. The runner cancels leftover triggers when a position closes.

*Multi-leg safety.* Batches are not atomic on the API, so the runner closes any leg that filled when a later leg fails.

*Market data.* Candles, order book, funding history and tickers feed the strategy backtests, the agent's research tools, chart overlays and the Home volume chart. Reads are cached.

*Account state.* Free margin and open positions are read from chain and checked before any order, one owner per market across bots.

*Builder code.* Orders carry our builder ID with a fee cap that the trader sees and signs in the enrollment message.

**The agent.** A model drives the same market-data tools through a small tool loop. It starts with the account balance, checks funding, price history and the book, calls a preview that returns sizing, liquidation prices, slippage and rule violations, and submits a bot card. Paper bots track fake money against live prices. Live bots use the enrollment key.

**Tests.** The enrollment signing, trigger order maths, runner rollback and agent loop each have a check that passes against stubs or live market data. The enrollment fix was confirmed against Perpl: a wallet without an account now gets a clear "account not found" instead of an opaque rejection.

CHECK: a full live run on a funded account (enroll, place a guard stop, see it rest on Perpl, cancel it). Save the order IDs.

---

## 4. Perpl: Best Analytics / Risk Tool

**Analytics (web tab and the Home chart)**
- Perpl protocol volume, daily and cumulative, with ranges.
- A markets table with open interest, funding and maximum leverage.
- Capital flows and risk: how much is at risk and where.
- Wallet profiles built from chain events: size tier, win rate, streaks, drawdown, best and worst trade, and Nansen labels for the address.
- A leaderboard of on-chain results.
- Home shows seven days of exchange volume when the trader holds nothing.

**Risk before a trade (`preview_strategy`)**
For every strategy card the tool returns:
- Notional and entry fees per leg and in total.
- Maximum loss at the stop, as a number in AUSD.
- Liquidation price and distance for each leg.
- Slippage in basis points from the real order book for the size.
- Rule violations: no stop, stop beyond liquidation, leverage above the cap, spread or slippage too high, too many legs, margin above the limit.
Blocking violations disable the start button.

**Risk during a position**
- Entry, liquidation, stop and target lines on charts.
- Bin position view: allocation, average entry, per-leg P&L and a P&L chart at the trader's entry prices, with 1D and 1W ranges.
- Exchange-side stops placed by bots.
- Smart-money agreement shown beside each bin.

**Risk limits**
- Per-wallet caps on bots and leverage.
- A $10 minimum order, so no dust orders.
- A low-gas warning.
- A server kill switch that stops every route and the runner.
- Referral codes can lift the caps, and that choice is explicit.

---

## 5. Nansen AI: Best use of Nansen

Smart money is used to decide, not to decorate.

1. **Pulse.** The backend (`backend/src/nansen`) fetches smart-money net flow per asset over 1 hour, 24 hours, 7 days and 30 days, with the number of traders and a stance (buying, selling or flat), and caches the result.
2. **Bins.** The bin pop-up lists the stance per asset with net flow and traders. Each bin card shows a tag of how many legs smart money agrees with.
3. **Bot gate.** A card can set Signal to Nansen. The shared gate checks each leg's direction against its stance and returns pass or block with a reason that is shown to the trader. A blocked bot does not open.
4. **Agent.** The agent has a smart-money tool and is told to use it only when the signal is on.
5. **Wallet intel.** Analytics shows labels for a looked-up wallet.
6. **Trade and asset pages** show the same read in web and in the Android app.
7. **Credits.** A credit cap (300 by default) and caching keep the key from running dry, and the status endpoint reports what is left.

Note for judges: the flow is across chains for the asset (the token list is returned in the response), and the UI says so.

---

## 6. Monad Foundation: Best Mera-Powered UX on Monad

A trader's whole journey uses Mera, and the rough edges are handled.

- **No seed phrase.** One passkey creates and later reopens the account, on web and Android.
- **Returning-user mode.** If a credential is stored, the panel shows only "Sign in" and a "Use a different account" link. After Sign out or Delete data, all options return. A second tap is never needed to find them.
- **Import.** Bring a private key you already have. It is sealed by the passkey and stays on the device.
- **Hand-off after saving the passkey.** A dot-matrix loader reads MERA, then counts up while the passkey is saved, then reads MERA x OPENCASH and opens Home. It only shows until the passkey is saved.
- **Errors in plain words.** "No passkey found", "prompt closed", "domain mismatch" each have clear text, and the app tells you what to do next.
- **Recovery phrase.** The passkey can reveal it on demand.
- **One approval for autonomous trading.** The same wallet signs the bot mandate and the trade-key enrollment.
- **Gentle onboarding.** A referral code can lift limits and send a gas grant, so the first trade works. First-run cards explain Bins, Strategies and Trade.
- **Privacy by default.** Profile and email never leave the device.

---

## 7. Monad Foundation: Mera: One Passkey, Many Keys

**The design.** One passkey is the root. Each job gets its own namespace and its own key.

| Namespace | Protects | Stored where | Salt |
|---|---|---|---|
| `terminal.profile.v1` | Name, email, avatar choice | Device | From sign-in result |
| `terminal.import.v1` | Imported private key | Device | From sign-in result |
| `opencash.notes.v2` | Private notes | Server, ciphertext only | Its own PRF salt |
| `opencash.agent.v1` | Agent chat history and last drafted bot | Server, ciphertext only | Its own PRF salt |

**How a key is made.** A passkey request is made with a salt equal to the hash of the namespace name. The PRF result is run through HKDF with a namespace-specific tag to make a 32-byte key. Records are AES-GCM sealed with a random nonce and carry their namespace, so a record cannot be opened as another one. The key is held only in memory for the session.

**Why the server cannot read anything.** The vault route accepts a sealed record and a wallet signature over its digest. It rejects writes signed by anyone else, rejects stale signatures and checks that the namespace in the URL matches the record. The server never has a key. Account deletion removes the records.

**Cross-device test.** On a second device (or a fresh browser profile) sign in with the same passkey. Open Account, then Private notes, and press Unlock. Approve the passkey request. The same notes decrypt. In the Bots tab, "Unlock memory" restores the agent chat and the last drafted bot the same way.

**What we are not claiming.**
- Profile and import keys come from the sign-in result, not their own salts.
- The language-model provider receives whatever you ask the agent, so memory is protected at rest, not in flight.
- The cross-device restore has been tested in code with simulated keys and not yet with a real passkey on two devices.

CHECK: run the two-device demo live before you submit.
