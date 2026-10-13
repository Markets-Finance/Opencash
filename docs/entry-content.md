# Entry content for the project form

Fix these three things in the form before pasting anything:

1. **Tagline says "stocks".** Perpl on Monad lists 11 crypto perps (BTC, ETH, SOL, MON, HYPE, ZEC, LIT, VVV, PUMP, NEAR, UNI), not stocks. A judge who checks will see that. Suggested 200-character tagline (about 105 characters): `Isolated-margin perps on Monad. Build bins, run guarded bots, trade with a passkey.`
2. **Repo link.** The form has `github.com/Markets-Finance/open-cash`. The releases and APKs live on `github.com/Markets-Finance/Opencash`. Make sure the link you submit is the public repo that actually holds the code, or share it with metropolis@hackathon.monad.xyz.
3. **Short description (120 chars max).** The one in the form is fine. If you want it to match: `Go from strategy to trade in one passkey tap on Perpl markets, with bots that guard every position.`

---

## Project description (paste into the 8,000-character box)

**The problem.** Trading perpetuals on-chain is still a power-user sport. You need a wallet extension and a seed phrase, you place one market at a time, you size every leg by hand, you babysit stops, and a bot means giving a script your keys. Retail traders think in themes ("AI coins", "chains that matter", "Bitcoin purists"), not in single tickers, and they lose money because the tools make risk management an afterthought.

**What OpenCash is.** OpenCash is a mobile-first trading app for Perpl perpetuals on Monad mainnet. A trader signs in with a passkey, deposits AUSD, and goes from an idea to a live, protected position in one tap. It ships as an Android app and a web app that share the same account.

**The four ways to trade**

1. **Bins.** A bin is a themed basket of Perpl markets with a size per leg: Blue Chip Boomers (BTC, ETH, SOL), Chain Gang (ETH, SOL, MON, HYPE), Satoshi's Lovers (BTC and ZEC), Hyper Fans (HYPE, LIT, VVV), and more. One tap opens every leg in a single transaction that fills together or reverts together, so a basket cannot half-open. Margin is split by fixed, liquidity, risk or equal weighting. Once a bin is open, its screen becomes a position view: average entry per asset, allocation, per-leg P&L, and a P&L chart at your own entry prices.
2. **Direct trades.** Any Perpl market, long or short, with entry, liquidation, stop and target lines drawn on the chart.
3. **An agent that drafts the bot.** Type "long BTC with the smallest safe size, 2x, stop 6%" or "pair trade long MON, short BTC". The agent reads your Perpl balance, wallet and gas, looks at funding, price history and the order book, tests its own draft against the risk rules, and returns a bot card. It never opens a trade by itself. The trader chooses Paper (fake money, live prices) or Live, then presses Start. Boundaries are enforced in its instructions: Perpl markets on Monad only, no promises of returns, no requests for keys.
4. **Rule strategies.** Donchian breakouts, grids, trailing stops and regular buying, backtested on real Perpl history, then run on paper, then live.

**Bots that keep working.** One passkey approval enrolls a trade-only Perpl API key, which can place and cancel orders but cannot withdraw. A server runner then keeps bots going when the phone is off. Stops and targets are sent to Perpl as trigger orders, so they rest on the exchange and still protect the position if our server goes down. Multi-leg entries roll back on a partial fill. Every bot is created under a signed mandate. There is a per-wallet cap on bots and leverage, a $10 minimum order, and a server kill switch.

**Mera, used for more than signing.** The wallet key comes from the passkey, so there is no seed phrase. Beyond signing, we seal the user's profile, an imported wallet key, private notes and the agent's chat memory under separate Mera PRF-derived keys. Notes and agent memory sync to our server as ciphertext only and decrypt on any device holding the same passkey.

**Any-chain deposits, AUSD everywhere.** Aurora Intents lets a trader pay from another chain. They get a one-time deposit address, send from any wallet, and USDC lands in their Monad address. The app converts it to AUSD in the background. Balances, margin, P&L, deposits and sends are all shown in AUSD.

**Analytics and risk.** The Analytics tab shows Perpl protocol volume, open interest, funding, capital flows and wallet profiles. Every strategy card is previewed before it can start: notional, fees, maximum loss at the stop, liquidation distance and slippage from the real order book. Nansen smart-money flow appears on every bin and can gate a bot, so it opens only when smart money agrees.

**What is real today.** The app and server run on Monad mainnet. A four-leg bin position (MON, ETH, SOL, HYPE) was opened from the app on mainnet with real funds. Paper bots, the agent, notes sync, the Aurora flow and the Analytics tab run against live data. Live server bots are deployed and under test: the trade-key enrollment signing was fixed on October 14 and still needs a full live run on a funded account.

**Why it can win.** The same passkey that logs you in also signs your trades, seals your notes and remembers your agent chats. The same risk numbers shown before you trade drive the stops that guard you afterwards. And a trader never has to touch a seed phrase, a script or a keyboard shortcut to get a themed basket live and protected.

**Built with.** Expo (Android) and Astro (web), a Fastify server with a bot runner, Perpl's REST API and on-chain contracts, Mera passkeys, Aurora Intents, Nansen, Neon Postgres, Cloudflare Pages and an AWS Lightsail server. The source is in a single monorepo with a shared TypeScript package used by both clients and the server.

---

## Who are your first users, and how will you reach them? (paste into the box)

**First users.** Active Perpl and Monad traders who are comfortable with leverage but find multi-market trading slow: people who already hold AUSD or MON on Monad and trade BTC, ETH, SOL and the newer listings. Within them, three groups:

1. **Theme traders.** People who say "I want exposure to the Hyperliquid ecosystem" or "I want Bitcoin and a privacy coin", not a single ticker. Bins give them that in one tap with sizing done for them.
2. **Mobile-first traders.** Users who trade from a phone and do not want to install a wallet extension. The passkey sign-in removes the biggest barrier.
3. **Cautious bot users.** People who want automation but not custody risk. A trade-only key that cannot withdraw, stops that live on the exchange and a paper mode that costs nothing lower the fear.

**How we reach them**

- **X (@opencashhq).** The app has a Share on X button that posts "I'm trading on OpenCash with @opencashhq. Join me" with the link, and a preview image. Every user becomes a distribution channel.
- **Monad and Perpl communities.** Show the bin position view and the P&L chart in short clips for the Monad Discord, X and Telegram groups, and reply to Perpl trading threads with real bins.
- **Referral codes.** Early users get a code that lifts bot and leverage limits and sends a small MON gas grant, so a first trade works right after sign-up.
- **Hackathon judges and builders.** The same product is the demo: paper mode needs no funds, so anyone can try it in two minutes.
- **Leaderboards (next).** The app already has shared strategies and a ranking that uses real on-chain results from Perpl, so skilled traders can attract followers.

**Honest status.** We have the team and early testers today, not a user base. The first target is 50 active traders in the first month through the channels above, and the measure is how many start a bin or a paper bot and come back within seven days.

---

## Steps to try the product (private to judges; paste into the box)

No test login is needed. OpenCash uses passkeys, so you create your own account in seconds.

**Fastest path, no money, 2 minutes (web or phone)**

1. Open https://monad.opencash.in and tap **Launch terminal**. On Android, you can instead install the APK from https://github.com/Markets-Finance/Opencash/releases/latest (Allow installs from this source when asked).
2. Tap **Create an account**. Enter any name and email, then approve the passkey prompt (Face ID, fingerprint or PIN). If you have a referral code, enter it in the optional field. [REFERRAL CODE: add yours here]
3. After the dot-matrix "MERA x OPENCASH" loader you land on Home. The Perpl volume chart shows live exchange data.
4. Open **Bots**. Tap a prompt such as "Safe BTC long", or type "long MON short BTC 2x stop 8%". The agent checks your balance and the markets, then drafts a bot card.
5. Choose **Paper · fake money** and tap **Start paper bot**. It opens at the live price and shows live P&L under Your bots.
6. Open **Analytics** for Perpl volume, funding and a wallet lookup, and open **Bins** to see Nansen smart-money flow on each bin.

**Real-money path (Monad mainnet), about 5 minutes**

1. Fund your OpenCash address (shown under Account and in Deposit) with at least $10 of AUSD on Monad, and a little MON for gas. Referral accounts receive 0.5 MON automatically.
2. From another chain? Open **Deposit**, then **Another chain**, pick what you hold, get the one-time address and send. The app converts USDC to AUSD.
3. Open **Bins**, pick one (for example Chain Gang), enter an amount of at least the minimum shown, and tap **Trade this bin**. Review the legs and confirm. Every leg opens in one transaction.
4. Open the same bin again. It now shows your position: average entry, allocation, P&L per asset and a chart. **Add to this bin** or **Close all legs** from there.
5. For a live bot, move at least $10 into Perpl (Account, Move between accounts), go to **Bots**, draft a bot, choose **Live**, and approve once with your passkey.

**Mera features to check**

- **Sign out, then reopen:** returning users see one Sign in button. After Sign out, the full set of options returns.
- **Private notes:** Account, Private notes. Write, save, then sign in on a second device with the same passkey and tap **Unlock**.
- **Agent memory:** in the Bots tab, tap **Unlock memory** after chatting with the agent. Open the same account on another device and unlock to see the history.

Not supported: testnet. The app runs on Monad mainnet only.

---

## Demo video script (3 minutes max; show the product, not slides)

| Time | Show | Say |
|---|---|---|
| 0:00-0:15 | Phone: open the app, tap Create account, approve the passkey | "No seed phrase. One passkey makes the account." |
| 0:15-0:35 | MERA x OPENCASH loader, then Home with the AUSD balance | "Everything is in AUSD. This balance is on Monad mainnet." |
| 0:35-1:00 | Deposit, Another chain: pick USDC, show the quote and the one-time address | "Pay from any chain with Aurora. It lands as AUSD." |
| 1:00-1:35 | Bins: open Chain Gang, show Nansen smart money, tap Trade this bin, confirm | "Four markets, one transaction, one tap." |
| 1:35-2:05 | Open the bin again: position view, per-leg P&L, the bin chart | "The bin becomes a position you can read and manage." |
| 2:05-2:35 | Bots: ask the agent in plain words, show what it checked, start a paper bot | "The agent checks my balance and the market, then drafts. I choose paper or live." |
| 2:35-3:00 | Account, Private notes: save, then open on a second device and unlock | "Same passkey, new device, same notes. The server only has ciphertext." |

Record on a real phone with sound. Keep the real-money trade short and use a small amount.

## Pitch video script (2 minutes max)

- 0:00-0:20 Who you are and the problem: "Trading perps on-chain still means seed phrases, one ticker at a time and stops you have to babysit."
- 0:20-0:50 The product: passkey sign-in, bins, an agent that drafts bots, bots that protect positions on the exchange.
- 0:50-1:20 Why now: Perpl on Monad has deep markets and an API, Mera makes passkey wallets possible, Aurora brings any-chain funds.
- 1:20-1:45 What is real: mainnet bin trade, notes sealed under separate passkey keys, Nansen-gated bots.
- 1:45-2:00 The ask: try it in two minutes with paper mode, and tell us which bin you want next.

## Promo clip (30 seconds)

Three quick cuts: passkey create and loader (5s), tapping Trade this bin and the chart filling (12s), the position view with green P&L and the Share on X button (8s), end on "MERA x OPENCASH" and the link (5s). Caption: "Strategy to trade in one tap. OpenCash on Monad."

---

For the seven bounty boxes, use `docs/bounty-submissions.md`.
