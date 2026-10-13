# Deploying OpenCash on Monad

AWS runs the backend; Cloudflare runs DNS, the tunnel and the web app. Nothing listens on a public port.

| Piece | Where | Name |
|---|---|---|
| Backend + bot runner | AWS Lightsail (ap-southeast-2, 1 GB) | systemd `opencash-monad`, `/opt/opencash-monad` |
| API hostname | Cloudflare Tunnel | `monad-api.opencash.in` (one level, so the free certificate covers it) |
| Web | Cloudflare Pages project `opencash` | `monad.opencash.in` |
| Secrets | the server only | `/etc/opencash-monad.env` (mode 600) |

## Steps

1. Create the instance and attach a static IP (Ubuntu 24.04, `micro_3_2`, SSH only).
2. `cloudflared tunnel create opencash-monad-api` and `cloudflared tunnel route dns opencash-monad-api monad-api.opencash.in`.
3. `SERVER=ubuntu@<ip> deploy/push.sh` copies the repo (no dotfiles, no `.env`, no `data/`).
4. On the server: `sudo TUNNEL_ID=<id> bash /opt/opencash-monad/deploy/setup.sh` (installs Node, pnpm, swap, the service, backups and cloudflared; generates `BOT_KEY_SECRET`).
5. Copy the tunnel credentials JSON to `/etc/cloudflared/<id>.json` (mode 600) over `scp`.
6. Fill the API keys in `/etc/opencash-monad.env` by hand, then `sudo systemctl enable --now opencash-monad cloudflared`.
7. Check `https://monad-api.opencash.in/health`.
8. Web: `pnpm deploy:landing` (landing only) or `pnpm deploy:app` (full dashboard against the API above; also set `launchEnabled` in `web/src/data/site.ts`).
9. After everything is up: an AWS budget of $15 a month for this project.

## Neon (ready, not wired)

`backend/db/schema.sql` is the schema and `backend/src/store/neon.ts` a `NeonStore` with the same `get/all/set/delete` as `JsonFileStore`. Nothing uses it yet; the app still writes `backend/data/`. To switch on: create a Neon project, put `DATABASE_URL` in `/etc/opencash-monad.env`, run `pnpm --filter backend db:migrate`, then swap each `new JsonFileStore(...)` for `new NeonStore("<collection>")` and copy the JSON files in.

## Kill switch

`SERVER=ubuntu@<ip> deploy/kill.sh on|off|status` toggles `backend/data/kill-switch`: every API route but `/health` answers 404 and the bot runner pauses. The website follows when Pages has `BACKEND_URL=https://monad-api.opencash.in`, or set Pages `KILL_SWITCH=on` directly.

## Gas relayer

A first-time referral redemption sends the new wallet a small MON grant so its first swap and orders have gas. Set in `/etc/opencash-monad.env`:

- `RELAYER_PRIVATE_KEY` funds the grants. Keep only a small MON balance on it.
- `RELAYER_ALLOW_MAINNET=1` is required on mainnet.
- `GAS_GRANT_MON` is the grant size, default `0.1`.
- `GAS_GRANT_DAILY_CAP` is the most grants per day, default `30`.

Each wallet is granted once, and only when its MON balance is below the grant. With no key set, redemption still works and no gas is sent.
