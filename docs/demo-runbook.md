# Live demo runbook (Mera bounties)

Two bounties are judged live: **Best Mera-Powered UX** (stateless test, session design, time to first transaction) and **Mera: One Passkey, Many Keys** (cross-device test). This runbook covers both in one 6-minute run, plus the 2-minute video.

## Rehearse first (do this tonight, it is the biggest risk)

1. **Stateless test.** Sign in, then clear site data (browser DevTools, Application, Clear site data), reload https://monad.opencash.in/dashboard/ and sign in with the passkey. Check: same address as before? Same Perpl balance and positions? Private notes still there after Unlock? Write down what is lost.
   - Expected: address, balances, positions, notes and agent memory come back. **Name and email do not**, because they are sealed on the device only. Say so before a judge finds it.
2. **Fresh profile.** Open a new Chrome profile (or a phone) and sign in. This only works if the passkey is synced (iCloud Keychain, Google Password Manager) or you use a cross-device QR sign-in. Test it now.
3. **Fund the demo account.** Perpl account: at least $15 AUSD. Wallet: at least 0.2 MON. Keep trades under $20.
4. Close other tabs, turn notifications off, set the browser zoom to 110%.

## What to show, and what to say (6 minutes)

| Min | Action | Say |
|---|---|---|
| 0:00 | Landing page, tap Launch terminal, Create an account, tap Create, approve the passkey. Start a stopwatch on the landing page | "One passkey ceremony. No seed phrase, no extension, no email code." |
| 0:30 | Home loads. Show the address and the free-gas message if you use a referral code | "Identity is the passkey. The wallet is derived from it." |
| 1:00 | Bins, pick Chain Gang, Trade this bin, confirm. Point out that no second passkey prompt appears | "Every transaction is signed in the page with a key derived from the passkey. The ceremony happened once." |
| 1:40 | Show the transaction link and the position view | "Confirmed on Monad in about a second." |
| 2:00 | **Stateless test.** DevTools, Clear site data. Reload, sign in | "Now I delete everything the browser knows." |
| 2:40 | Same address, balance and position appear | "Identity and access rebuild from the passkey alone. Our server never held a key." |
| 3:00 | Account, Private notes: unlock (passkey prompt), the saved note reappears | "Notes use their own passkey salt. The server holds ciphertext only." |
| 3:30 | Terminal: `curl -s https://monad-api.opencash.in/vault/YOUR_ADDRESS/opencash.notes.v2` | "This is all we store. It is unreadable without the passkey." |
| 4:00 | Second profile or phone: sign in, unlock notes | "Fresh device, same passkey, same state." |
| 4:40 | Bots: Unlock memory, the agent chat history appears | "The agent's memory is another namespace. Sealed at rest, restored anywhere." |
| 5:20 | Sign out, show the full options panel | "Signing out zeroes the key in memory." |
| 5:40 | One closing line | "Mera is the whole account layer. Everything else is optional." |

## Facts to state clearly

- **One-prompt onboarding:** one passkey ceremony to create the account and sign in. No email, no OTP.
- **Prompt-free signing:** after sign-in, the key lives in memory for that session and signs transactions without another prompt. It is zeroed on sign out.
- **Re-prompt actions:** Private notes and Agent memory ask for the passkey again, because each uses its own salt.
- **No custody backend for accounts:** the server stores no account keys. It stores bot settings and an encrypted trade-only Perpl key only if the user turns on autonomous trading.
- **Stack composability:** Mera with Perpl (trades), Aurora Intents (funding), Nansen (signals), Neon (ciphertext).

## Gaps the judges may notice (answer honestly)

| Likely question | Honest answer | Fix if time allows |
|---|---|---|
| "Is the session scoped or time-limited?" | Not yet. The signing key lives in memory until the tab closes or the user signs out. There is no idle timeout and no spending scope. | Add an idle lock: after 15 minutes, zero the key and show "Session locked, unlock with passkey". |
| "Where is time-to-first-transaction?" | Not measured in the app. Estimate: about 11 taps and 30 to 50 seconds with a funded wallet. | Add a built-in timer and tap counter. |
| "Does name and email survive the stateless test?" | No. They are sealed on the device only, by design. Address, balances and notes survive. | Sync them to the vault as another sealed namespace. |
| "What if the passkey is lost?" | The wallet is lost unless the recovery phrase was saved. We say so in the Terms. | None needed. |
| "Does the model provider see my agent chat?" | Yes, what you ask is sent to answer it. Stored memory is sealed. | None needed. |

## Backup plan if something breaks on stage

- Passkey prompt fails: show the recorded video from `docs/bounty-videos.md` and say the live passkey flow needs the device's biometric.
- Network or RPC is slow: switch to the paper-bot path, which needs no transaction.
- A second device is unavailable: use a fresh Chrome profile.
