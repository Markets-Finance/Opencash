# Monad Market Factory

Metropolis hackathon entry (Track 1 — Onchain Finance & Trading). A mobile-first
perp trading app on Monad, sitting on a permissionless market factory.

Research and decisions live in [`docs/`](./docs).

## Layout

| Path | What |
|---|---|
| `android` | Expo / React Native app |
| `web` | Astro landing + web app |
| `backend` | Fastify API |
| `packages/shared` | Chain config shared by all three |
| `contracts` | Foundry contracts |

## Running

```sh
pnpm install
pnpm web       # http://localhost:4321
pnpm backend   # http://localhost:8787/health
pnpm android   # Expo dev server
```

```sh
cd contracts && forge build
```

## Chains

Monad mainnet `143`, testnet `10143`.
