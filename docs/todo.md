# Monad to-do

Saved 2026-10-12.

## Deployment (AWS + Cloudflare only)

- [x] Deployment config for this project (2026-10-12: `deploy/` + `deploy/README.md`, `pnpm deploy:app`; nothing deployed yet): backend on AWS (same pattern as the hood branch: systemd service, Cloudflare Tunnel, no open ports), web on Cloudflare Pages (`opencash` project, `monad.opencash.in`).
  - The single-level-subdomain rule applies: an API host like `monad-api.opencash.in` is covered by Cloudflare's free certificate, `api.monad.opencash.in` is not.
  - Env from `backend/.env`; secrets entered on the server only.
  - Kill switch: server flag `backend/data/kill-switch` or Pages env `KILL_SWITCH=on`.
- [ ] After everything is up: create an AWS budget of **$15 / month** for this project (the hood project already has `opencash-monthly-15usd`; give this one its own name).

## Mainnet

- [x] Everything defaults to mainnet (2026-10-12): shared `networkFrom/chainFor/perplFor`, web `PUBLIC_NETWORK`, mobile `EXPO_PUBLIC_NETWORK`, backend `NETWORK`; auth is production by default (dev only with `EXPO_PUBLIC_AUTH_MODE=dev`); `launchEnabled` on; `INTENTS_ALLOW_LIVE=1` in the server template (swap-in sends real funds, never run with real money yet).

## Product

- [x] Live lab strategies on Perpl (2026-10-12; engine tested on fakes, routes and dry run tested locally against live Perpl candles; no real order yet — needs a saved trade key and testnet AUSD): venue-agnostic engine from hood + Perpl adapter, server-watched stops (Perpl's API takes no stop orders), market orders only, grid off until order ids and fills per order are readable.
- [x] Strategy-vault prototype (2026-10-12): `contracts/src/BinVault.sol`, 11 Foundry tests on a mock Perpl. Epochs: deposits/redeems only while settled and flat (checked on-chain via `getAccountByAddr` locked balance + position bitmaps), manager trades only allowed perps under a leverage cap via `execOrders`, anyone settles after the deadline, performance fee over a high-water mark, dead shares against the donation attack. NOT deployed or audited; not run against the real Perpl contract.
- [x] Prize savings prototype (2026-10-12): `contracts/src/PrizeSavings.sol`, 7 Foundry tests. Principal in an ERC-4626 yield vault, time-weighted tickets, one winner per week by weighted race (score = -ln(U)/tickets), claim window, treasury fee. Still open: which AUSD yield vault on Monad, a randomness source live on Monad, legal review. NOT deployed or audited.
- [x] Monad APK (2026-10-12): `xyz.opencash.monad`, mainnet, release-signed, launches to sign-in on the emulator. Hood's native folder is backed up at `/Users/daiwi/project/monad-android-hood-backup` (restore it before building hood again). Needs a splash `image` in app.json and `local.properties` restored after any `prebuild`.
- [ ] iOS `apple-app-site-association` on `monad.opencash.in`.
- [ ] Chart trade overlay port (entry, liquidation, target/stop) — needs Perpl trigger support checked first.

## Port from hood (fixed there 2026-10-12, user reports from the live hood APK)

- [ ] **Bots crash: `crypto.getRandomValues must be defined`.** `@noble/hashes/crypto.js` captures `globalThis.crypto` when it loads, so the polyfill imported in `mobile/src/lib/mera.ts` comes too late and creating a bot (or any key) fails. Fix: `import 'react-native-get-random-values';` as the first line of `mobile/index.ts`. Hood commit to copy from: "Fix auth, icons, bots".
- [ ] **Sign-in screen buttons (app + web).** Replace the small "Create an account" link at the top and the round SIGN IN button with full-width stacked buttons: Sign in (primary), Import a wallet, Create an account. Files: `mobile/src/components/AuthShell.tsx`, `web/src/components/dashboard/Gate.astro`, `web/src/styles/dashboard/gate.css`.
- [ ] **No passkey on sign-in (app + web).** On `PASSKEY_OPERATION_FAILED` in sign-in mode, show a "No passkey found" box with Create an account (primary), Import a wallet, and "Try signing in again". Files: `mobile/src/screens/Account.tsx` (`missing` state), `web/src/scripts/dashboard/gate.ts` (`data-gate-missing`).
- [ ] **Market icons not loading (app + web).** The app showed blank dark circles because the letter fallback only ran on `onError`, which doesn't fire reliably on Android. Show the letter by default and swap to the logo only on `onLoad` (`AssetMark.tsx`). On the web, a failed logo left a white letter on the white logo circle; switch to `row-mark--letter` on error (`dom.ts`). Check Perpl's symbols for wrong logos (hood mapped commodities like GOLD to a stock's logo; it now uses `assetLogoUrl` with a non-equity list).
- [ ] **Minimum deposit note on the bots page (app + web).** "Deposit at least $X before starting a bot". Hood uses $10 (Hyperliquid's minimum order). Check Perpl's real minimum order size in AUSD before copying the number.
- [ ] **In-app updater via GitHub Releases (app).** On launch, read `https://api.github.com/repos/<owner>/<repo>/releases/latest`, compare `tag_name` with the installed version, and if newer offer the release's `.apk` asset (download, then Android's installer). Needs a PUBLIC repo for releases: the code repos are private, and a token can't ship inside an APK. Bump `versionCode`/`versionName` for every release (installing over the same or a lower `versionCode` fails). Built on hood first; copy it once that works.
