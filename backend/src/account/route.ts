import type { FastifyInstance } from "fastify";
import { deleteAccountMessage } from "shared";
import { isAddress, type Address, type Hex } from "viem";
import { verifySigned } from "../auth/signed.js";
import { deleteBoardsForOwner } from "../boards/store.js";
import { deleteIdentityLink } from "../identity/route.js";
import { deleteLive, listLive } from "../live/store.js";
import { deleteSnapshotsForOwner } from "../portfolio/store.js";
import { deleteBot, listBots } from "../runner/store.js";
import { removeKey } from "../runner/vault.js";
import { deleteStrategyData } from "../strategies/store.js";

export function registerAccountRoute(app: FastifyInstance): void {
  app.post<{ Body: { owner?: Address; issuedAt?: number; signature?: Hex } }>("/account/delete", async (request, reply) => {
    const { owner = "" as Address, issuedAt = 0, signature = "0x" as Hex } = request.body ?? {};
    if (!isAddress(owner)) return reply.status(400).send({ error: "invalid owner" });
    const problem = await verifySigned(owner, deleteAccountMessage(owner, issuedAt), signature, Date.now());
    if (problem) return reply.status(401).send({ error: problem });

    const live = await listLive({ owner });
    if (live.some((bot) => bot.enabled)) return reply.status(409).send({ error: "Stop your live bots first" });
    for (const bot of live) await deleteLive(bot.id);
    const bots = await listBots({ owner });
    for (const bot of bots) await deleteBot(bot.id);
    await removeKey(owner, "testnet");
    await removeKey(owner, "mainnet");
    const strategyData = await deleteStrategyData(owner);

    return {
      ok: true,
      removed: {
        liveBots: live.length,
        bots: bots.length,
        boards: await deleteBoardsForOwner(owner),
        snapshots: await deleteSnapshotsForOwner(owner),
        sharedStrategies: strategyData.strategies,
        copyRecords: strategyData.copies,
        xLink: await deleteIdentityLink(owner),
      },
    };
  });
}
