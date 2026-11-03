import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { assistRequestSchema } from "../shared/contract";
import { askModel, copilotModelConfig, CopilotNotConfiguredError } from "./llm";
import { offlineAnswer } from "./offline";
import { sanitizeRequest } from "./sanitize";

// Local assist server: the extension's only backend, plus the fictional demo form at /copilot-demo/.

if (existsSync(".env")) process.loadEnvFile(".env");
const PORT = Number(process.env.PORT || 3000);
const LOCAL = ["localhost", "127.0.0.1", "[::1]", "::1"];
const DEMO = resolve("demo");
const BUILT = resolve("dist/extension"); // served at /dev/extension/ so the bundle can be tested without installing it
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".md": "text/plain; charset=utf-8" };
const MAX_BODY = 256 * 1024;

function allowedOrigin(origin?: string) {
  if (!origin) return null;
  if (origin.startsWith("chrome-extension://")) return origin;
  try { return LOCAL.includes(new URL(origin).hostname.toLowerCase()) ? origin : null; } catch { return null; }
}

function blocked(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (origin && !allowedOrigin(origin)) return "The copilot only accepts requests from the extension or this machine.";
  if (process.env.COPILOT_ALLOW_REMOTE === "true") return null;
  const host = (req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
  return LOCAL.includes(host) ? null : "The copilot only answers requests from this machine.";
}

function send(req: IncomingMessage, res: ServerResponse, status: number, body?: unknown) {
  const origin = allowedOrigin(req.headers.origin);
  const h: Record<string, string> = { vary: "Origin", "cache-control": "no-store" };
  if (origin) Object.assign(h, { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600" });
  if (body === undefined) { res.writeHead(status, h).end(); return; }
  res.writeHead(status, { ...h, "content-type": "application/json" }).end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return undefined; chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return undefined; }
}

async function assist(req: IncomingMessage, res: ServerResponse) {
  const b = blocked(req);
  if (b) return send(req, res, 404, { error: b });
  if (req.method === "OPTIONS") return send(req, res, 204);
  if (req.method === "GET") return send(req, res, 200, { ok: true, ai: copilotModelConfig() !== null });
  if (req.method !== "POST") return send(req, res, 405, { error: "Method not allowed." });
  const parsed = assistRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return send(req, res, 400, { error: "That request couldn't be read. Rescan the page and ask again (a question and page context are required)." });
  const request = sanitizeRequest(parsed.data);
  try {
    return send(req, res, 200, await askModel(request));
  } catch (error) {
    const notice = error instanceof CopilotNotConfiguredError ? undefined : "AI unavailable — showing built-in guidance.";
    if (notice) console.warn("copilot: model call failed:", error instanceof Error ? error.message : "unknown"); // never logs request bodies
    return send(req, res, 200, { ...offlineAnswer(request), ...(notice ? { notice } : {}) });
  }
}

async function serveFile(res: ServerResponse, root: string, rel: string) {
  const file = join(root, normalize(rel || "index.html"));
  if (!file.startsWith(root)) return res.writeHead(404).end();
  try {
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
  } catch { res.writeHead(404).end("Not found"); }
}

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path === "/api/copilot/assist") return void assist(req, res);
  if (path === "/" || path === "/copilot-demo") return void res.writeHead(302, { location: "/copilot-demo/" }).end();
  if (path.startsWith("/copilot-demo/")) return void serveFile(res, DEMO, path.slice("/copilot-demo/".length));
  if (path.startsWith("/dev/extension/")) return void serveFile(res, BUILT, path.slice("/dev/extension/".length));
  res.writeHead(404).end("Not found");
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Strike assist server on http://localhost:${PORT}  (AI: ${copilotModelConfig() ? "on" : "off — built-in guidance"})`);
  console.log(`Demo form: http://localhost:${PORT}/copilot-demo/`);
});
