# Bounty demo videos: scripts and shot lists

One video per bounty, each under 2 minutes. Show the real product, not slides. Speak about 150 words a minute, so the voiceover lines below fit the time.

## Before you record (30 minutes)

**Accounts and money**
- Phone with APK 1.0.9 installed, signed in to your real account.
- A laptop browser signed in to the same account at https://monad.opencash.in.
- A **second browser profile (or another phone)** with no OpenCash data, for the cross-device shots.
- At least $15 AUSD in your Perpl account and 0.1 MON of gas (a referral account gets 0.5 MON). Small amounts only.
- One small cross-chain deposit sent ahead of time. Its transaction link is B-roll for the Aurora video.
- One live bot already created, so you can show its orders. Keep size tiny.

**Recording**
- Phone: Android's built-in screen recorder. Turn on the microphone. Enable Do Not Disturb.
- Laptop: QuickTime (File, New Screen Recording) or OBS at 1080p.
- Dark theme, hide notifications, and zoom the browser to 110% so text reads on a phone.
- Record voiceover live while you click. Retake any shot that stumbles. Trim silence afterwards.
- Do not show a private key, a seed phrase, or your referral code on screen.

**On-camera helper for the Mera Many Keys video** (shows the server only holds ciphertext). Replace the address with your own, which is on Account:
```bash
curl -s https://monad-api.opencash.in/vault/YOUR_ADDRESS/opencash.notes.v2
```

---

## 1. Agora: Best Mobile Trading App on Monad (about 2:00)

| Time | Show (phone) | Say |
|---|---|---|
| 0:00 | Open the app on the sign-in screen | "OpenCash is a mobile trading app for Perpl on Monad. No seed phrase, no extension." |
| 0:10 | Create account, approve the passkey | "I sign up with a passkey. Mera turns it into my wallet." |
| 0:25 | The MERA x OPENCASH loader, then Home | "The loader plays while the passkey is saved, then I land on Home." |
| 0:35 | Home: AUSD balance, volume chart | "Everything is in AUSD, Monad's stablecoin. This is my live balance." |
| 0:50 | Deposit, Another chain, show the quote | "I can fund from any chain. It arrives as AUSD." |
| 1:05 | Bins, open Chain Gang, Trade this bin, confirm | "One tap opens four markets on Perpl in a single transaction." |
| 1:30 | Reopen the bin: position view and chart | "The bin becomes a position I can read: average entry, allocation, profit and a chart." |
| 1:50 | Close with a line over the Home screen | "Mera sign-in, AUSD, and Perpl trades, all on one phone." |

## 2. Aurora Intents: Bring Any-Chain Liquidity to Monad (about 1:30)

| Time | Show | Say |
|---|---|---|
| 0:00 | Home, tap Deposit | "Funds on another chain? Deposit lets me bring them to Monad." |
| 0:12 | Another chain tab, pick USDC on another chain, amount | "I choose what I hold and how much." |
| 0:30 | The live quote: amount out, cost, time | "The quote shows what I get, the cost and the guaranteed minimum." |
| 0:45 | Get my deposit address, show it and the refund field | "I get a one-time address. A failed swap refunds to my address." |
| 1:00 | B-roll: the earlier deposit's transaction, then Home | "Aurora delivers USDC to my own Monad address. OpenCash converts it to AUSD for me." |
| 1:20 | The AUSD balance on Home | "From any chain to margin on Perpl, without a bridge screen." |

## 3. Perpl: Best use of Perpl's API (about 2:00)

| Time | Show (laptop) | Say |
|---|---|---|
| 0:00 | Bots tab, ask the agent: "Long BTC, smallest safe size, 2x, stop 6%" | "An agent drives Perpl's market data and my account to draft a bot." |
| 0:20 | The reply and the "checked" tags (balances, markets, snapshot, preview) | "It read my balance, the market and ran its own risk preview." |
| 0:35 | The new-bot card with the risk preview | "Margin, liquidation and maximum loss are all shown before I start." |
| 0:50 | Choose Live, Start, approve once | "One passkey approval enrolls a trade-only Perpl API key. It cannot withdraw." |
| 1:10 | Trade tab: the Agent row | "The bot now runs on our server through Perpl's API." |
| 1:25 | Perpl app: the position and the resting stop and target orders | "Stops and targets sit on Perpl as trigger orders, so they protect me even if our server is down." |
| 1:50 | Back to Bots, point at the log with a transaction link | "Every action is logged." |

Make sure the live bot has really placed and shown stop and target orders on Perpl before you record this one.

## 4. Perpl: Best Analytics / Risk Tool (about 1:45)

| Time | Show | Say |
|---|---|---|
| 0:00 | Analytics tab, Protocol: daily and cumulative volume | "Analytics shows Perpl volume, open interest and funding live." |
| 0:20 | The markets table and funding | "Every market, side by side." |
| 0:35 | Wallets: look up an address | "Paste any address to see its size tier, streaks and drawdown." |
| 0:55 | Bots: draft a bot, show the preview (max loss, liquidation, slippage, rule violations) | "Before money moves, the risk preview shows maximum loss at the stop, liquidation distance and slippage from the real order book." |
| 1:15 | Asset chart with entry, liquidation, stop, target lines | "Once I hold a position, the chart draws its risk lines." |
| 1:30 | Reopen a bin: P&L chart; change the chart-height dropdown | "Bins show profit by asset and a chart at my own entry prices." |

## 5. Nansen AI: Best use of Nansen (about 1:30)

| Time | Show | Say |
|---|---|---|
| 0:00 | Bins carousel with the smart-money tags | "Each bin card shows whether smart money agrees." |
| 0:15 | Open a bin: the 7-day Nansen table (buying, selling, flat, net flow, traders) | "Nansen's smart-money flow, per asset." |
| 0:35 | Bots: draft a card, open More rules, set Signal to Nansen | "I can require smart money to agree before a bot opens." |
| 0:55 | Start the bot, show the gate message (passed or blocked and why) | "The gate says why it passed or blocked." |
| 1:10 | Analytics, Agent tools, Smart money | "The agent uses the same data as a tool." |
| 1:20 | Wallets lookup showing Nansen labels | "And labels on any wallet I look up." |

## 6. Monad Foundation: Best Mera-Powered UX on Monad (about 1:45)

| Time | Show | Say |
|---|---|---|
| 0:00 | Fresh sign-in screen, Create account | "Mera makes the whole journey passkey-first." |
| 0:15 | Passkey prompt, loader, Home | "No seed phrase. One tap to create." |
| 0:35 | Sign out, reopen: only Sign in and Use a different account | "Come back and there is just one button." |
| 0:50 | Sign in with the passkey | "One passkey prompt and I am in." |
| 1:00 | Sign out, then Use a different account: the full panel with Import | "Use a different account brings back create and import." |
| 1:15 | Delete my data, then reopen: full panel | "Delete my data, and everything resets." |
| 1:30 | Create an account with a referral code, show the free-gas message | "A referral code unlocks limits and sends a little gas so my first trade just works." |

## 7. Monad Foundation: Mera: One Passkey, Many Keys (about 2:00)

| Time | Show | Say |
|---|---|---|
| 0:00 | Account tab, one line over the card | "One passkey. Many keys. Not just for signing." |
| 0:12 | Account, Private notes: write a note, Lock and save, approve the passkey | "Notes are locked with a key my passkey makes just for notes, with its own salt." |
| 0:35 | Terminal: the curl to `/vault/...notes.v2` showing ciphertext | "This is all our server has. It is ciphertext. We cannot read it." |
| 0:55 | Second browser profile: sign in with the same passkey | "Now a fresh device, same passkey." |
| 1:10 | Private notes, Unlock, approve | "I unlock, and the same note is back." |
| 1:30 | Bots: chat with the agent, Unlock memory, then on the second device Unlock memory | "The agent's memory works the same way. Sealed at rest, restored on any device." |
| 1:50 | Show the namespace table (docs or a slide for 5 seconds) | "Profile, import, notes and agent memory each get their own key. Zero secrets stored." |

If you can only show one cross-device moment, use the notes. Say plainly that the agent provider sees your question, and that memory protects what is saved.

---

## After recording

- Export each as MP4, under 2 minutes, with a clear title: `OpenCash - <bounty name>`.
- Upload to YouTube (unlisted) or Loom and paste the link in that bounty's video box.
- For the main entry, cut the 3-minute demo from clips of videos 1, 2 and 6, and the 2-minute pitch from the pitch script in `docs/entry-content.md`.
- Keep one raw take of the real mainnet bin trade. It is the strongest proof you have.
