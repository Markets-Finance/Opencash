import type { FastifyInstance } from "fastify";
import { isAddress, type Address } from "viem";
import {
  addBinToBoard,
  createBoard,
  deleteBoard,
  getBoard,
  listBoardsForOwner,
  removeBinFromBoard,
  renameBoard,
} from "./store.js";

function requireOwnership(board: { owner: Address } | undefined, owner: unknown) {
  if (!board) {
    const err = new Error("Board not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (typeof owner !== "string" || board.owner.toLowerCase() !== owner.toLowerCase()) {
    const err = new Error("owner does not match this board");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

export function registerBoardsRoute(app: FastifyInstance): void {
  app.post<{ Body: { owner: string; name: string; binIds?: string[] } }>(
    "/boards",
    async (request, reply) => {
      const { owner, name, binIds } = request.body;
      if (!isAddress(owner)) return reply.status(400).send({ error: "invalid owner address" });
      if (!name || name.trim() === "") return reply.status(400).send({ error: "name is required" });
      try {
        return await createBoard(owner, name.trim(), binIds ?? []);
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
    },
  );

  app.get<{ Querystring: { owner: string } }>("/boards", async (request, reply) => {
    const { owner } = request.query;
    if (!isAddress(owner)) return reply.status(400).send({ error: "invalid owner address" });
    return listBoardsForOwner(owner);
  });

  app.get<{ Params: { id: string } }>("/boards/:id", async (request, reply) => {
    const board = await getBoard(request.params.id);
    if (!board) return reply.status(404).send({ error: "not found" });
    return board;
  });

  app.patch<{
    Params: { id: string };
    Body: { owner: string; name?: string; addBinId?: string; removeBinId?: string };
  }>("/boards/:id", async (request, reply) => {
    const { id } = request.params;
    const { owner, name, addBinId, removeBinId } = request.body;
    try {
      const board = await getBoard(id);
      requireOwnership(board, owner);

      let current = board!;
      if (name !== undefined) current = await renameBoard(id, name.trim());
      if (addBinId !== undefined) current = await addBinToBoard(id, addBinId);
      if (removeBinId !== undefined) current = await removeBinFromBoard(id, removeBinId);
      return current;
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 400;
      return reply.status(statusCode).send({ error: (error as Error).message });
    }
  });

  app.delete<{ Params: { id: string }; Body: { owner: string } }>(
    "/boards/:id",
    async (request, reply) => {
      const board = await getBoard(request.params.id);
      try {
        requireOwnership(board, request.body?.owner);
      } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 400;
        return reply.status(statusCode).send({ error: (error as Error).message });
      }
      await deleteBoard(request.params.id);
      return { ok: true };
    },
  );
}
