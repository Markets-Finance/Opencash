# How OpenCash uses Nansen

OpenCash turns Nansen smart-money data into a trading signal that can allow or block a trade, and into identity context for wallets on the Perpl leaderboard. Nansen does not index Perpl itself (its perp-trade data covers Hyperliquid), so it is used for token-level intelligence and wallet identity on top of OpenCash's own Perpl data.

## Endpoints used (REST, `apikey` header, base `https://api.nansen.ai/api/v1`)

| Endpoint | Credits | Used for | Cache |
|---|---|---|---|
| `POST /smart-money/netflow` | 5 | Smart-money net flow (1h, 24h, 7d, 30d) and trader count per token, all chains, mapped to Perpl markets (for example ETH to ETH and WETH, BTC to WBTC and cbBTC) | 2 hours (`NANSEN_PULSE_TTL_MIN`) |
| `POST /profiler/address/pnl-summary` | 1 | Realised PnL, win rate and top tokens of a Perpl wallet on Monad | 1 hour |
| `POST /profiler/address/current-balance` | 1 | Monad holdings of that wallet | 1 hour |
| `POST /profiler/address/related-wallets` | 1 | First funder and related wallets, each openable as a profile | 24 hours |
| `POST /profiler/address/labels` | 100 | Nansen labels (smart trader, fund, entity), only on request and only if enough credits remain | 24 hours |

## Where it appears

- **Bins:** each bin card and detail screen shows whether smart money backs its legs ("Smart money backs 2 of 3 legs") with per-asset stance and 7-day flow. Web and mobile.
- **Agent signal dropdown (optional):** a strategy card can be set to "Nansen smart money must agree". Opening the card, and every bot tick before it opens a position, checks the signal: any leg against smart money blocks the trade, and at least half the weight must be backed. Set the signal to None to trade without it. Web card and mobile Agent view.
- **Agent tool:** `smart_money` lets the agent read the flows when drafting, with a "Smart money" button in the web analysis tools.
- **Asset pages:** smart-money stance and flow next to the order book depth.
- **Analytics, Wallets:** a "Nansen intelligence" card on every wallet profile: PnL, holdings, related wallets, and labels on request.

## Credit discipline

Free keys get 100 trial credits and then top up to 10 a day. The backend caches responses on disk, de-duplicates in-flight calls, enforces a per-run credit cap (`NANSEN_CREDIT_CAP`, default 300), and refuses label calls when fewer than 100 credits remain.

## Verified

- Live calls with a real key: smart-money netflow (ETH buying +$2.09M over 7 days and BTC selling -$304K at the time of the check) and the PnL, balances and related-wallets reads on a Perpl wallet.
- The signal gate blocked the Majors bin because smart money was selling BTC.
- Not verified live: the labels endpoint (needs 100 credits).

## Limits

- No historical smart-money data is used, so a signal-gated strategy cannot be replayed on past prices; it runs as a live or paper bot.
- Smart-money flow is token-level across chains, not Perpl positioning.
