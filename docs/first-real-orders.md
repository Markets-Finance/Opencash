# First real Perpl orders (mainnet)

Staged 2026-10-13. You drive the app; nothing here is placed by Claude. Keep every order at or under $20 notional.

## Before you start

- [ ] Server runs the latest code: `SERVER=ubuntu@52.62.146.51 deploy/push.sh`, then restart `opencash-monad` (the live server still has the pre-stop-order runner).
- [ ] Web: `pnpm deploy:app` so the dashboard has the server-bot flow and chart overlay.
- [ ] Wallet holds a small AUSD balance (Perpl needs at least $10 to open an account, so fund about $15) and a little MON for gas.
- [ ] Kill switch known: `SERVER=ubuntu@52.62.146.51 deploy/kill.sh on` stops every route and the runner.

## Order of tests (stop at the first failure)

1. **Manual market order.** Trade tab, BTC or MON, about $10 notional, 2x. Expect a position with entry and liquidation lines on the chart. Close it. Check the AUSD comes back.
2. **Bin, all legs.** Pick a two-leg bin at an amount where the button says "Open …". Expect both legs open in one transaction and a Manage link per leg. Close both.
3. **Trade key for bots.** Create a Perpl API key in the Perpl app, turn on One-Click Trading, then paste it under Strategies, Live strategies, Save trade key. Expect "Perpl confirmed it".
4. **Server guard bot.** Bots, Agent, On server, "long MON 2x $10 stop 8% tp 12%", Guard. Press Start only after you hold that position. Expect log lines "Exchange stop placed: …". Check on Perpl that two trigger orders exist.
5. **Close from the bot.** Stop the bot. Expect the resting triggers cancelled. If one is left, cancel it in Perpl by hand and tell me its fields.
6. **Server auto bot (only if 4 and 5 passed).** Auto mode opens by itself on funding carry, so keep the allocation at $10.

## What is unverified

- Field names on `GET /v1/trading/orders` (`oid`, `mkt`, `tp`). If step 4 logs "Could not place an exchange stop", send me the log line.
- Whether a trigger needs `lp` to auto-cancel. We cancel it ourselves on close.
- Server bot sizing and the rollback of a partial fill have only run against stubs.
- The overlay's liquidation price is our estimate from the maintenance margin, not Perpl's own figure.

## If something goes wrong

Kill switch first, then close positions in the Perpl app. Do not retry an order that errored until the log says why.
