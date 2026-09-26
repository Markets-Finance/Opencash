import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance } from "fastify";
import { buildAgentMcpServer } from "./server.js";

// Stateless mode: a fresh server + transport per request, so concurrent
// calls never share state and there is no session to expire or clean up.
export function registerMcpRoute(app: FastifyInstance): void {
  app.post("/mcp", async (request, reply) => {
    reply.hijack();

    const server = buildAgentMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });
}
