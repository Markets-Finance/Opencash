# Monad Market Factory

Metropolis hackathon entry (Track 1 — Onchain Finance & Trading). A mobile-first
perp trading app on Monad, sitting on a permissionless market factory.

Research and decisions live in [`docs/`](./docs).

## Layout

| Path | What |
|---|---|
| `apps/android` | Expo / React Native app |
| `apps/web` | Next.js landing + web app |
| `apps/backend` | Fastify API |
| `packages/shared` | Chain config shared by all three |
| `contracts` | Foundry contracts |

## Running

```sh
pnpm install
pnpm web       # http://localhost:3000
pnpm backend   # http://localhost:8787/health
pnpm android   # Expo dev server
```

```sh
cd contracts && forge build
```

## Chains

Monad mainnet `143`, testnet `10143`.
