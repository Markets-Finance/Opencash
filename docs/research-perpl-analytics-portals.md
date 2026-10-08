# Perpl analytics portal: what the best ones do and what OpenCash takes from them

Written 2026-10-08 for the Metropolis "Perpl dashboard" bounty: a real-time protocol view plus a wallet drill-down, dark mode, signal over volume, a demo video of up to two minutes.

## What the best portals do

| Portal | What it is good at | What to learn |
|---|---|---|
| **Nado stats** (stats.nado.xyz) | Protocol clarity. Headline tiles: 24h volume, all-time volume, open interest, TVL, 24h flows (deposited and withdrawn), 24h and total traders, daily active users. Charts: volume (daily and cumulative), open interest, TVL, daily active traders. Default window 30 days. Tabs: Overview, Volumes, OI / Funding / Liquidations, Revenue and Users, TVL and Yield. | One page of headline numbers, then one tab per question. Daily plus cumulative on the same chart. 30 days as the default window. |
| **ASXN HyperScreener** | Breadth. Whale positions, liquidations, top traders, large trades, funding rates, open interest, in one free dashboard. Mixes its own node, the exchange API, Dune and Hypurrscan. Refreshes daily. | Cover the questions people ask first (who is big, who got liquidated, where is funding extreme). Say where each number comes from. |
| **HyperTracker** | Trader intelligence. 16 behavioural cohorts: eight by perp equity (Shrimp up to Leviathan, $5M and above) and eight by all-time PnL (Giga-Rekt, losing more than $1M, up to Money Printer, winning more than $1M). Liquidation risk scoring, multi-timeframe leaderboards, and a watchlist table with equity, bias, position value, unrealised PnL, cohort badge and distance to liquidation in one row. | Badges make a wallet readable at a glance. A watchlist table beats separate pages. Distance to liquidation is the most actionable number. |
| **Hyperdash** | Analytics next to execution. An alpha leaderboard ranked by PnL, Sharpe and drawdown, copy trading, liquidation heatmaps. | Rank by risk-adjusted results, not raw PnL. Put the action next to the insight. |
| **CoinGlass** | Cross-exchange context. Alerts for positions above $1M, PnL distribution across 350K wallets. | Alerts and distributions turn a table into a story. |
| **LighterDash** | Trader depth. Trade analyzer fed by an exported trade list (date, market, side, closed PnL, fee, role, type), AI recommendations, wallet comparison, liquidation tool, futures calculator. | Behavioural insight (what you do wrong) is the most shareable output. Comparison is a first-class view. |
| **DefiLlama perps** | Market share across protocols. | An optional "Perpl vs the rest" strip gives context cheaply. |
| **Hypurrscan** | Explorer: addresses, transactions, TWAP state, fund flows at millisecond precision. | Every row links to the transaction. |

Judging rubric reduces to: fast, dark, near real time, protocol to wallet in one click, no clutter.

## What Perpl actually gives us (checked 2026-10-08, mainnet)

- Public REST: context, ticker (all markets), candles, funding, order book. Candles go back to 2026-02-12 at daily resolution (239 daily candles for BTC), so 24h, 7d, 30d and all-time volume are computable now.
- TVL: the AUSD balance of the exchange contract, $3.77M today.
- Account endpoints (positions, fills, history, equity chart) need an API key and only return the key owner's own account. They cannot power a search for any wallet.
- Everything wallet-level therefore comes from **on-chain events and contract reads**: positions and balance by contract read, trades, PnL, deposits, withdrawals and liquidations from the event log.
- The public RPC allows about 100 blocks per log call (about 40 seconds of chain). Deep history needs our own store that grows from first sync, or a proper indexer such as Envio.
- **Open interest is balanced by construction** in an order-book perp (long equals short). Long/short skew has to be shown through funding, and through the positions of the wallets we index, not through OI.

## What OpenCash takes, in order

1. Nado's structure: headline tiles, then tabs by question, daily plus cumulative, 30 days default.
2. HyperTracker's badges and watchlist row, scaled to Perpl: equity tiers and PnL tiers, with distance to liquidation.
3. LighterDash's wallet comparison and behavioural readout, fed by chain events instead of a CSV, with our agent writing the plain-language summary later.
4. Hyperdash's idea of putting the action beside the insight: from a wallet, one tap to follow its strategy, test a similar one, or open the same market.
5. What nobody has: verified X handles on wallets, and ranks by what followers of a strategy earned.

## Limits to state in the demo

History for wallets and flows builds from the first sync; volume history is complete from candles. Fee figures are estimated until the event store has enough data.
