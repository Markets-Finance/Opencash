# Decisions

Metropolis hackathon. Registration Sep 1, **submissions close Oct 13, 2026**, judging
Oct 14–27, winners Nov 3. Submission needs: working product, public project profile,
demo video, write-up, code link.

## Track

**Track 1 — Onchain Finance & Trading.** $30,000 per track split three ways, plus a
$25,000 grand champion picked across all four tracks. Track 1 names "new primitives
constituting a market" and, separately, mobile-first trading for a specific segment.

## Product

1. A mobile app on Monad where you trade perps with a passkey — Face ID, no seed phrase,
   no pending states, collateral that keeps earning.
2. Underneath it, a market factory: anyone deploys a perp market by picking an oracle
   feed, leverage cap and fee split, posts a slashable stake, and earns on everything
   that market trades.
3. We seed crypto majors and Pyth-priced stock and gold markets ourselves; then a third
   party lists their own market from a phone, live, in under a minute.

Market sequence: majors first (MON, BTC, ETH) because a new venue needs liquidity before
it needs novelty; then tokenized-stock and commodity markets; then open listing to
institutions.

## Sponsor bounties targeted

| Bounty | Prize | Why |
|---|---|---|
| Agora — Best Mobile Trading App on Monad | $10,000 | Direct hit, largest single bounty. Agora issues AUSD — supporting AUSD as collateral strengthens it |
| Monad Foundation — Best Mera-Powered UX | $2,500 | Passkey onboarding is already the mobile design |
| Monad Foundation — Mera: One Passkey, Many Keys | $2,500 | Held signing session, same code path |
| Privy (or Dynamic) | $5,000 | Embedded wallet, official Monad template |
| Kuru — Bring New Assets & Markets to Kuru | $5,000 | Claimable if new markets route spot through Kuru |
| Envio | $1,000 | Indexer is needed anyway; factory auto-registering child markets is their showcase |
| Kimi / Qwen credits | $3K / $5K credits | Only if the daily-signal feature ships |

Sponsor *perks* are separate from bounties: Quicknode Build Plan (3 months), Tenderly Pro
(~$7.2K), Zerion API Builder (1 month) — one voucher per team, claim links in
`metropolis-hackathon-resources.md`.

## Assumptions each decision rests on

- **"No Monad venue has permissionless market deployment."** Unverified. If Bean or Perpl
  already allows it, the wedge narrows to mobile UX and the pitch must change. Settle this
  first — see Open questions in the research dossier.
- **Bean already lists stocks, gold, oil and FX on Monad at 50x.** Our novelty is *who may
  list and who earns*, not "stock perps on Monad". Lead with that or a judge reads it as a
  reskin.
- **Pyth Indices make 24/7 equity pricing a dependency, not a build.** If those feeds are
  not actually available on Monad, the equity leg is cut and we ship crypto-only
  permissionless listing — the primitive still stands.
- **A vault, not a CLOB.** A brand-new market has no market makers. Dreamcash still needed
  Selini Capital plus $200K/week of Tether's money to make its own markets tradeable;
  assume we will need a seeded vault and small caps, not organic depth.

## Stack

pnpm workspaces. `android` Expo/React Native · `web` Astro · `backend`
Fastify + viem · `packages/shared` chain config · `contracts` Foundry.

Android is Expo rather than native Kotlin to keep one TypeScript codebase across all
three surfaces and to reuse Monad's official React Native + Privy templates.
