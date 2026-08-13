import { serveStatic } from "hono/bun";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { Hono } from "hono";
import config from "./zosite.json";
import { openHkelIndex } from "./src/hk/search";
import { researchHongKongLaw, researchRequestSchema } from "./src/hk/research";

const app = new Hono();
const production = process.env.NODE_ENV === "production";

app.get("/api/health", (c) => {
  try {
    const sources = openHkelIndex().sourceStatus();
    return c.json({ ok: true, service: "hk-legal-research", sources });
  } catch {
    return c.json({ ok: false, service: "hk-legal-research", error: "Legislation index unavailable" }, 503);
  }
});

app.get("/api/sources", (c) => {
  try {
    return c.json({ sources: openHkelIndex().sourceStatus() });
  } catch {
    return c.json({ error: "Legislation index unavailable" }, 503);
  }
});

app.get("/api/provisions/search", (c) => {
  const query = c.req.query("q")?.trim() ?? "";
  const language = c.req.query("language") === "en" ? "en" : "zh-Hant";
  if (query.length < 3) return c.json({ error: "Query must contain at least 3 characters" }, 400);
  try {
    const results = openHkelIndex().search({ query, language, limit: 20 });
    return c.json({ query, language, results });
  } catch {
    return c.json({ error: "Legislation search unavailable" }, 503);
  }
});

app.post("/api/research", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = researchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid research request", details: parsed.error.issues }, 400);
  }
  try {
    return c.json(await researchHongKongLaw(parsed.data.question, parsed.data.language));
  } catch (error) {
    console.error("Research request failed", error);
    const message = error instanceof Error && error.message.startsWith("OpenCode request failed")
      ? "The research model is temporarily unavailable"
      : "Legal research is temporarily unavailable";
    return c.json({ error: message }, 503);
  }
});

if (production) configureProduction();
else await configureDevelopment();

const port = Number(
  process.env.PORT ?? (production ? config.publish.published_port : config.local_port),
);

export default { fetch: app.fetch, port, idleTimeout: 255 };

function configureProduction(): void {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();
    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();
    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) return new Response(file);
    }
    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
}

async function configureDevelopment(): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        const template = stripViteClient(
          await vite.transformIndexHtml(url, await Bun.file("./index.html").text()),
        );
        return c.html(template, { headers: { "Cache-Control": "no-store" } });
      }
      const transformed = await vite.transformRequest(url).catch(() => null);
      if (transformed) {
        return new Response(transformed.code, {
          headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" },
        });
      }
      const template = stripViteClient(
        await vite.transformIndexHtml("/", await Bun.file("./index.html").text()),
      );
      return c.html(template, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });
  return vite;
}

function stripViteClient(html: string): string {
  return html.replace(/\s*<script type="module" src="\/@vite\/client"><\/script>\s*/, "\n");
}
