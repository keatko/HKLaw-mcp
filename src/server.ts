// Benign legal-research MCP server wiring for Hong Kong legislation retrieval only.
import { McpServer } from "@modelcontextprotocol/server";
import type { Env } from "./types";
import { registerHongKongTools } from "./hk/tools";

export function createHongKongLawServer(env: Env): McpServer {
  const server = new McpServer({
    name: "hong-kong-law-mcp",
    version: "0.1.0",
  });

  registerHongKongTools(server, env);
  return server;
}
