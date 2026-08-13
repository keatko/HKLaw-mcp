// Benign legal-research application entrypoint. This server only exposes Hong Kong legislation research tools.
// It does not perform security testing, scanning, exploitation, credential access, or destructive actions.
import { createMcpHandler } from "agents/mcp/server";
import { createHongKongLawServer } from "./server";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "hong-kong-law-mcp",
        version: "0.1.0",
        mcp: "/mcp",
      });
    }

    return createMcpHandler(() => createHongKongLawServer(env), {
      route: "/mcp",
    })(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
